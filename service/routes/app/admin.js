var express = require('express');
var router = express.Router();
var Response = require("../response")
var { getMysqlPool, beginTransaction } = require("../../db/db")
var request = require('request')
var fastXmlParser = require('fast-xml-parser');


router.post("/syncRss", function (req, response) {
    let { rss_id } = req.body;
    let result = new Response();
    result.data = res;
    response.json(result)
})

module.exports = router;