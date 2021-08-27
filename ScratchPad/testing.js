var express = require('express');
var oracledb = require('oracledb');
var SimpleOracleDB = require('simple-oracledb');

SimpleOracleDB.extend(oracledb);
oracledb.outFormat = oracledb.OBJECT;

const siteList = require('/javascripts/siteList.json');
var siteCode = "LAX";

oracledb.run({
  user: siteList.siteID[siteCode].user,
  password: siteList.siteID[siteCode].password,
  connectString: siteList.siteID[siteCode].connectString
}, function(connection, callback) {
  //run some database operations in a transaction
  connection.transaction([
    function getFlights() {
      connection.query('SELECT * FROM RMTDESCRIPTION', function onResults(error, flightRes) {
        if (error) {
          console.error(error.message);
        } else {
          console.log(flightRes);
        }
      })
    },
    function getHourly() {
      connection.query('SELECT * FROM MONITORLOC', function onResults(error, hourlyRes) {
        if (error) {
          console.error(error.message);
        } else {
          console.log(hourlyRes);
        }
      })
    }
  ], {
    sequence: true
  }, callback); //at end of transaction, call the oracledb provided callback
}, function onActionDone(error, result) {
  console.log("onTransactionResults was here");
});