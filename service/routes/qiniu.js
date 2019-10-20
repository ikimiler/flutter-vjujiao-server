var express = require('express');
var router = express.Router();
var qiniu = require("qiniu")
var Response = require("./response")

router.get("/getToken", function (req, response) {
    var accessKey = 'CTQSd1IBjCG50yzMhXkTvKvBbQrU8FZAh1f21KXw';
    var secretKey = '4tt3iBDEPQcsnJs1g7vyxAgJsoLSTb3dgayZlt76';
    var mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    var options = {
        scope: "2019project",
    };
    var putPolicy = new qiniu.rs.PutPolicy(options);
    var uploadToken = putPolicy.uploadToken(mac);
    var result = new Response();
    result.data = uploadToken;
    response.json(result)
})

module.exports = router;