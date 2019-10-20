var express = require('express');
var router = express.Router();

var user = require("./user")
var admin = require("./admin")
router.use("/user",user)
router.use("/admin",admin)

module.exports = router;