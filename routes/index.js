var express = require('express');
var router = express.Router();

let index = require('../controllers/index');

/* GET home page. */
router.get('/', index.get_index);
router.post('/sitecheck/', index.siteSelect);
router.get('/sitecheck/:siteID', index.siteCheck);


module.exports = router;