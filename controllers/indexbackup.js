var express = require('express');
var oracledb = require('oracledb');
var SimpleOracleDB = require('simple-oracledb');
var jsonQuery = require('json-query');

SimpleOracleDB.extend(oracledb);
oracledb.outFormat = oracledb.OBJECT;

master = require('../public/javascripts/master.json');
navigation = require('../public/javascripts/navigation.json');

exports.get_index = function(req, res, next) {
  res.render('index', {
    title: 'Operations Centre Tool',
    SitesUS: navigation['regionus'],
    SitesEMEA: navigation['regionemea'],
    SitesAPAC: navigation['regionapac'],
  });
}

exports.siteSelect = function(req, res, next) {
  res.render('sitecheck', {
    site: req.body.siteSelection
  });
}

exports.siteCheck = function(req, res, next) {
  var siteID = req.params.siteID;
  var res1 = [];
  var res2 = [];
  var res0 = [];
  var ICAO =master.siteID[siteID].sql.operAirportID;

  oracledb.createPool({
    retryCount: 5, //The max amount of retries to get a connection from the pool in case of any error (default to 10 if not provided)
    retryInterval: 500, //The interval in millies between get connection retry attempts (defaults to 250 millies if not provided)
    runValidationSQL: true, //True to ensure the connection returned is valid by running a test validation SQL (defaults to true)
    usePingValidation: true, //If runValidationSQL, this flag will define if validation should first attempt to use connection.ping instead of running a SQL
    validationSQL: 'SELECT 1 FROM DUAL', //The test SQL to invoke before returning a connection to validate the connection is open (defaults to 'SELECT 1 FROM DUAL')
    user: master.siteID[siteID].sql.username,
    password: master.siteID[siteID].sql.password,
    connectString: master.siteID[siteID].sql.connectString
    //any other oracledb pool attributes
  }, function onPoolCreated(error, pool) {
    pool.getConnection(function onConnection(poolError, connection) {
      //continue flow (connection, if provided, has been tested to ensure it is valid)
      pool.run(function(connection, callback) {
        //run some database operations in a transaction
        pool.parallelQuery([{
            sql: "select * from rmtdescription where state = 'A' order by RMTID",

            options: {
              //any options here
            }
          },
          {
            sql: "select to_char(sysdate-rownum+1, 'YYYY-MM-DD') as dates from dual connect by level <= 12 order by dates asc",

            options: {
              //any options here
            }
          },
          {
            sql:   "select r.rmtid, r.dates, count(h.timedate) total from (select rmtid, locid, dates from rmtdescription, (select to_char(sysdate-rownum+1, 'YYYY-MM-DD') as dates from dual connect by level <= 12 ) where state = 'A') r left join hourly h on r.locid = h.rmtid and r.dates = to_char(h.timedate, 'YYYY-MM-DD') and h.timedate >= trunc(sysdate - 14) group by r.rmtid, r.dates order by r.rmtid, r.dates asc",

          },

          {
            sql:   "select r.wxid, r.dates, count(h.timedate) total from (select wxid, dates from weatherdesc, (select to_char(sysdate-rownum+1, 'YYYY-MM-DD') as dates from dual connect by level <= 12 ) where state = 'A') r left join weather h on r.wxid = h.wxid and r.dates = to_char(h.timedate, 'YYYY-MM-DD') and h.timedate >= trunc(sysdate - 14) group by r.wxid, r.dates order by r.wxid, r.dates asc",

          },

          {
            sql:   "SELECT OPSSUMMARY.DATES AS SummaryDate,(OPSSUMMARY.TRACKSWITHPLANS + OPSSUMMARY.TRACKSOnly + OPSSUMMARY.PLANSONLY ) AS Flights, OPSSUMMARY.TRACKS AS Tracks, (OPSSUMMARY.PLANSONLY + OPSSUMMARY.TRACKSWITHPLANS) AS Plans, OPSSUMMARY.PLANSONLY AS PlanOnly, OPSSUMMARY.TRACKSWITHPLANS AS PlansWithTracks, OPSSUMMARY.Arrivals AS ArrivalTracks, OPSSUMMARY.Departures AS DeptTracks, OPSSUMMARY.Overflights AS Overflights, OPSSUMMARY.ADTRACKS AS ADTracks, (CASE WHEN OPSSUMMARY.PLANS!=0 THEN ROUND((100*OPSSUMMARY.TRACKSWITHPLANS/(OPSSUMMARY.PLANSONLY+OPSSUMMARY.TRACKSWITHPLANS)),2) Else 0 End) AS PT, (CASE WHEN OPSSUMMARY.ADTRACKS!=0 THEN ROUND((100*OPSSUMMARY.TRACKSWITHPLANS/OPSSUMMARY.ADTRACKS),2) Else 0 End) AS PlanCompleteness, (CASE WHEN OPSSUMMARY.Departures!=0 THEN ROUND((100*OPSSUMMARY.Arrivals/OPSSUMMARY.Departures),2) Else 0 End) AS AD, OPSSUMMARY.EVENTSForDAY AS NoiseEvents, OPSSUMMARY.CORRFLIGHTS AS FlightNoiseEvent FROM (SELECT OPSCOUNTS.DATES , OPSCOUNTS.TRACKS AS TRACKS , OPSCOUNTS.TRACKSWITHPLANS, (CASE WHEN (OPSCOUNTS.TRACKS-OPSCOUNTS.TRACKSWITHPLANS)<0 THEN 0 Else (OPSCOUNTS.TRACKS-OPSCOUNTS.TRACKSWITHPLANS) End ) AS TRACKSONLY, OPSCOUNTS.PLANS, (Select Count(*) from Strips where (Airportid in ("+ICAO + ") or Other_Port in ("+ICAO + ")) and To_char(ActualTime, 'DD-Mon-YYYY') = OPSCOUNTS.DATES and OpNum = 0) AS PLANSONLY, OPSCOUNTS.Arrivals , OPSCOUNTS.Departures , OPSCOUNTS.CorrDepartures, OPSCOUNTS.Overflights , OPSCOUNTS.ADTRACKS , OPSCOUNTS.CORRFLIGHTS ,(SELECT COUNT(*) FROM EVENTS WHERE EVENTS.MAXTIME BETWEEN TO_DATE(OPSCOUNTS.DATES,'DD-MON-YYYY') AND TO_DATE(OPSCOUNTS.DATES,'DD-MON-YYYY')+1-(1/(24*60*60)) ) AS EVENTSForDAY ,(SELECT COUNT(*) FROM EVENTS WHERE EVENTS.MAXTIME BETWEEN TO_DATE(OPSCOUNTS.DATES,'DD-MON-YYYY') AND TO_DATE(OPSCOUNTS.DATES,'DD-MON-YYYY')+1-(1/(24*60*60)) AND EVENTS.EVENTID>0 ) AS EVENTSForDAYCORR FROM (SELECT ALLOPS.DAYOFFLIGHTS AS Dates ,SUM(ALLOPS.Arrivals) AS Arrivals ,SUM(ALLOPS.Departures) AS Departures ,SUM(ALLOPS.CorrDepartures) AS CorrDepartures,SUM(ALLOPS.Overflights) AS Overflights ,SUM(ALLOPS.Arrivals) + SUM(ALLOPS.Departures) AS ADTRACKS ,SUM(ALLOPS.PLANEXISTS) AS TRACKSWITHPLANS ,SUM(ALLOPS.TRACKEXISTS) AS OPERWITHTRACKS, SUM(ALLOPS.PLANEXISTS) AS PLANS, COUNT(ALLOPS.OPNUM) AS TRACKS ,SUM(ALLOPS.FLIGHTHASEVENT) AS CORRFLIGHTS FROM (SELECT OPNUM ,to_char(OPER.ACTUALTIME,'DD-Mon-YYYY') AS DAYOFFLIGHTS, (CASE ADFLAG WHEN 'A' THEN 1 Else 0 End) AS Arrivals ,(CASE ADFLAG WHEN 'D' THEN 1 Else 0 End) AS Departures ,(CASE when EVENTID > 0 AND ADFLAG = 'D' THEN 1 Else 0 End) AS CorrDepartures,(CASE ADFLAG WHEN 'T' THEN 1 Else 0 End) AS Overflights ,(CASE EVENTID WHEN 0 THEN 0 Else 1 End) AS FLIGHTHASEVENT, (CASE NVL(FLIGHTNUM, '0') when '0' THEN 0 Else 1 End) AS PLANEXISTS, (SELECT COUNT(*) FROM TRACKS WHERE TRACKS.OPNUM = OPER.OPNUM) AS TRACKEXISTS, (SELECT COUNT(*) FROM TRACKS WHERE TRACKSTART BETWEEN TO_DATE(to_char(OPER.ACTUALTIME,'DD-MON-YYYY'),'DD-Mon-YYYY') AND TO_DATE(to_char(OPER.ACTUALTIME,'DD-MON-YYYY'),'DD-MON-YYYY')+1-(1/(24*60*60)) ) AS TRACKSForDAY FROM OPER WHERE OPER.ACTUALTIME >=trunc(sysdate - 7) and OPER.airportid in ("+ICAO + ") ) ALLOPS GROUP BY ALLOPS.DAYOFFLIGHTS) OPSCOUNTS) OPSSUMMARY ORDER BY to_date(DATES) Asc",

          }

        ], function onQueriesDone(error, results) {
          //do something with the result/error
          //const query1Results = results[0];
          //const query2Results = results[1];
          res0.push({
            RMTID: "DATE"
          });
          results[0].forEach(function(element) {
            res0.push({
              RMTID: element.RMTID
            });
          }, this);

            results[1].forEach(function(element) {
              res1.push({
                DATES: element.DATES.toString()
              });

          }, this);
          res1.forEach(function(element) {
            res2.push({
              RMTID: element.DATES,
              DATES: element.DATES,
              TOTAL: element.DATES
            });

          }, this);

          results[2].forEach(function(element) {
            res2.push({
              RMTID: element.RMTID,
              DATES: element.DATES.toString(),
              TOTAL: element.TOTAL
          });
          }, this);

          var test= {res2};
          var allDaysTotals = [];



          res1.forEach(function (element) {allDaysTotals.push(
            jsonQuery('res2[*DATES='+element.DATES+']', {
                        data: test
                      }).value
          );
        }, this);


        var weather = [];
        var weatherPerDay = [];

        res1.forEach(function(element) {
          weather.push({
            WXID: "Date",
            DATES: element.DATES,
            TOTAL: element.DATES
          });

        }, this);

        results[3].forEach(function(element) {
          weather.push({
            WXID: element.WXID,
            DATES: element.DATES.toString(),
            TOTAL: element.TOTAL
        });
        }, this);



                  res1.forEach(function (element) {weatherPerDay.push(
                    jsonQuery('weather[*DATES='+element.DATES+']', {
                                data: {weather}
                              }).value
                  );
                }, this);

                  var opsHead = Object.keys( results[4][0]);



          //res.json(res1);
          //console.log(opsHead);
           //console.log(res0[0]);
           //console.log(res1[0]);
          res.render('sitecheck', {
            resultsN: allDaysTotals,
            resultsW: weatherPerDay,
            resultsWID: weatherPerDay[0],
            resultsOps : results[4],
            opsHead : opsHead,
            rmts: res0,
            days: res1,
            siteName: master.siteID[siteID].details.name,
            SitesUS: navigation['regionus'],
            SitesEMEA: navigation['regionemea'],
            SitesAPAC: navigation['regionapac']
          });

        })
      })
    });
    //console.log(res1[0])

  })
 //res.json(res1);
}
