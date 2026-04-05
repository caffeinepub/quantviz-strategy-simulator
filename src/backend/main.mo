import Text "mo:base/Text";
import Int "mo:base/Int";
import Blob "mo:base/Blob";
import Cycles "mo:base/ExperimentalCycles";
import Error "mo:base/Error";

actor {
  type HttpRequestArgs = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [{ name : Text; value : Text }];
    body : ?Blob;
    method : { #get; #post; #head };
    transform : ?{
      function : shared query ({ response : HttpResponsePayload; context : Blob }) -> async HttpResponsePayload;
      context : Blob;
    };
  };

  type HttpResponsePayload = {
    status : Nat;
    headers : [{ name : Text; value : Text }];
    body : Blob;
  };

  type IC = actor {
    http_request : HttpRequestArgs -> async HttpResponsePayload;
  };

  let ic : IC = actor ("aaaaa-aa");

  // Transform function: strips all headers so replicas reach consensus on body only
  public query func transformResponse(args : { response : HttpResponsePayload; context : Blob }) : async HttpResponsePayload {
    {
      status = args.response.status;
      headers = [];
      body = args.response.body;
    }
  };

  // Format timestamp as YYYYMMDD for Stooq
  func formatDate(ts : Int) : Text {
    let secs = ts;
    let days = secs / 86400;
    var d = days;
    var y : Int = 1970;
    label yloop loop {
      let isLeap = (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0);
      let daysInYear : Int = if isLeap 366 else 365;
      if (d < daysInYear) break yloop;
      d -= daysInYear;
      y += 1;
    };
    let isLeap = (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0);
    let monthDays : [Int] = [31, if isLeap 29 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var m : Int = 1;
    label mloop for (md in monthDays.vals()) {
      if (d < md) break mloop;
      d -= md;
      m += 1;
    };
    let day = d + 1;
    let yStr = Int.toText(y);
    let mStr = if (m < 10) "0" # Int.toText(m) else Int.toText(m);
    let dStr = if (day < 10) "0" # Int.toText(day) else Int.toText(day);
    yStr # mStr # dStr
  };

  // Check if CSV text has at least 2 lines of actual data
  func hasData(csv : Text) : Bool {
    let lines = Text.split(csv, #char '\n');
    var count = 0;
    for (line in lines) {
      let t = Text.trim(line, #char ' ');
      if (t.size() > 0) { count += 1 };
    };
    count >= 2
  };

  // Fetch from a single Stooq URL
  func fetchUrl(url : Text) : async { #ok : Text; #err : Text } {
    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?500_000;
      headers = [
        { name = "User-Agent"; value = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        { name = "Accept"; value = "text/csv,text/plain,*/*" },
      ];
      body = null;
      method = #get;
      transform = ?{
        function = transformResponse;
        context = Blob.fromArray([]);
      };
    };
    Cycles.add<system>(10_000_000_000);
    try {
      let response = await ic.http_request(request);
      let bodyText = switch (Text.decodeUtf8(response.body)) {
        case (?t) t;
        case null "";
      };
      if (response.status >= 200 and response.status < 300) {
        #ok(bodyText)
      } else {
        #err("HTTP " # Int.toText(response.status) # ": " # bodyText)
      }
    } catch (e) {
      #err(Error.message(e))
    }
  };

  public func fetchStockData(symbol : Text, startTs : Int, endTs : Int) : async { #ok : Text; #err : Text } {
    let sym = Text.toLowercase(symbol);
    let d1 = formatDate(startTs);
    let d2 = formatDate(endTs);

    // If user already specified a suffix, use it directly
    if (Text.endsWith(sym, #text ".in") or Text.endsWith(sym, #text ".ns") or Text.endsWith(sym, #text ".bo")) {
      let url = "https://stooq.com/q/d/l/?s=" # sym # "&d1=" # d1 # "&d2=" # d2 # "&i=d";
      return await fetchUrl(url);
    };

    // Try .NS (NSE via Stooq) first
    let urlNS = "https://stooq.com/q/d/l/?s=" # sym # ".ns&d1=" # d1 # "&d2=" # d2 # "&i=d";
    let r1 = await fetchUrl(urlNS);
    switch (r1) {
      case (#ok(csv)) {
        if (hasData(csv)) return #ok(csv);
      };
      case (#err(_)) {};
    };

    // Fallback: try .IN (Stooq NSE alternate suffix)
    let urlIN = "https://stooq.com/q/d/l/?s=" # sym # ".in&d1=" # d1 # "&d2=" # d2 # "&i=d";
    let r2 = await fetchUrl(urlIN);
    switch (r2) {
      case (#ok(csv)) {
        if (hasData(csv)) return #ok(csv);
      };
      case (#err(_)) {};
    };

    // Fallback: try .BO (BSE)
    let urlBO = "https://stooq.com/q/d/l/?s=" # sym # ".bo&d1=" # d1 # "&d2=" # d2 # "&i=d";
    let r3 = await fetchUrl(urlBO);
    switch (r3) {
      case (#ok(csv)) {
        if (hasData(csv)) return #ok(csv);
      };
      case (#err(e)) {
        return #err(e);
      };
    };

    #err("No data found for symbol '" # symbol # "' on NSE or BSE. Please check the symbol name and date range.")
  };
}
