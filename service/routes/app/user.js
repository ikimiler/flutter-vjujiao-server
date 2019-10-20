var express = require('express');
var router = express.Router();
var Response = require("../response")
var jsonwebtoken = require("jsonwebtoken")
var { getMysqlPool, beginTransaction } = require("../../db/db")
var md5 = require('../../utis/md5')
var { randomCode, sendEmail, createActivationEmail, createFindPasswordEmail } = require('../../utis/email')

/**
 * 创建token 
 * TODO: token 延期需要处理，以最后以后使用app的时间戳为基准
 */
var contant = require("../../utis/contant")
function createToken(user_id) {
    return jsonwebtoken.sign({ user_id }, contant.JWT_SECRET, { expiresIn: 60 * 60 * 24 * 30 });
}

/**
 * 登陆
 */
router.post('/login', function (req, response) {
    let { email, password } = req.body;
    let result = new Response();
    getMysqlPool(function (connection) {
        let sql = `select * from user where email = ? and password = ?`
        connection.query(sql, [email, md5(password)], function (error, res) {
            if (res && res.length) {
                let data = res[0]
                delete data["password"]
                data.token = createToken(data.user_id)
                result.data = data
                response.json(result)
            } else {
                console.log('netlog-', error)
                result.code = -1;
                result.message = "账号或密码错误"
                response.json(result)
            }
            connection.release();
        })
    })
});

/**
 * 注册
 */
router.post("/register", function (req, response) {
    let { email, password, sex, name, intro, avatar_url } = req.body;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = "select * from user where email = ?"
        return beginTransaction.query(connection, sql, [email]).then(res => {
            if (res && res.length) {
                return Promise.reject("该邮箱已经被注册过了，请尝试更换")
            } else {
                let sql = "insert into user (email,password,name,sex,intro,avatar_url,time) values (?,?,?,?,?,?,?)"
                return beginTransaction.query(connection, sql, [email, md5(password), name, sex, intro, avatar_url, new Date().getTime()])
            }
        }).then(res => {
            let sql = "select * from user where email = ? and password = ?"
            return beginTransaction.query(connection, sql, [email, md5(password)])
        })
    }).then(res => {
        let data = res[0]
        delete data["password"]
        result.data = data;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error
        response.json(result)
    })
})

/**
 * 发送激活码
 */
router.post("/sendEmailCode", function (req, response) {
    let { email } = req.body;
    let result = new Response();
    let code = randomCode();
    beginTransaction(connection => {
        let sql = "select * from user where email = ?"
        return beginTransaction.query(connection, sql, [email]).then(res => {
            if (res && res.length) {
                return new Promise((resover, reject) => {
                    sendEmail(createActivationEmail(email, code), function (error, info) {
                        if (error) {
                            return reject(error)
                        } else {
                            let sql = "insert into email_code (email,code,time) values (?,?,?)"
                            beginTransaction.query(connection, sql, [email, code, new Date().getTime()]).then(res => {
                                resover("发送成功")
                            }).catch(error => {
                                reject(error)
                            })
                        }
                    })
                })
            } else {
                return Promise.reject("该邮箱还未注册")
            }
        })
    }).then(res => {
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error
        response.json(result)
    })
})

/**
 * 重设密码
 */
router.post("/resetPassword", function (req, response) {
    let { email, code, password, confirmPassword } = req.body;
    let result = new Response();
    if (password != confirmPassword) {
        result.code = -1;
        result.message = "两次密码输入不一致"
        response.json(result)
        return;
    }
    beginTransaction(function (connection) {
        let sql = "select * from user where email = ?"
        return beginTransaction.query(connection, sql, [email]).then(res => {
            if (res && res.length) {
                let sql = "select * from email_code where email = ? order by time desc"
                return beginTransaction.query(connection, sql, [email]).then(res => {
                    if (res && res.length) {
                        let data = res[0] //取最新的一条激活码
                        if (data.code == code && data.time + 1000 * 60 * 60 * 24 > new Date().getTime()) {
                            let sql = "update user set password = ? where email = ?"
                            return beginTransaction.query(connection, sql, [md5(password), email])
                        } else {
                            return Promise.reject("激活码错误或已过期")
                        }
                    } else {
                        return Promise.reject("激活码错误")
                    }
                })
            } else {
                return Promise.reject("该邮箱还未注册")
            }
        });
    }).then(res => {
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error
        response.json(result)
    })
})

/**
 * 更新用户信息
 */
router.put("/user", function (req, response) {
    let { name, sex, status, avatar_url, role, intro } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = "select * from user where user_id = ?"
        return beginTransaction.query(connection, sql, [user_id]).then(res => {
            if (res && res.length) {
                var data = res[0];
                let sql = "update user set name = ?,avatar_url = ?,role = ?,sex = ?,intro = ?,status = ? where user_id = ?"
                if (!name) {
                    name = data.name;
                }
                if (!sex) {
                    sex = data.sex;
                }
                if (!status) {
                    status = data.status;
                }
                if (!avatar_url) {
                    avatar_url = data.avatar_url;
                }
                if (!role) {
                    role = data.role;
                }
                if (!intro) {
                    intro = data.intro;
                }
                return beginTransaction.query(connection, sql, [name, avatar_url, role, sex, intro, status, backgroundImage, user_id])
            } else {
                return Promise.reject("用户不存在")
            }
        })
    }).then(res => {
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 获取用户信息
 */
router.get("/userinfo", function (req, response) {
    let { id } = req.query;
    let { user_id } = req.user;
    let result = new Response();
    getMysqlPool(function (connection) {
        let sql = `select *
                    from user u
                    where u.user_id = ?;`;
        connection.query(sql, [user_id], function (error, res) {
            if (error) {
                console.log('netlog-', error)
                result.code = -1;
                result.data = error;
                response.json(result)
            } else {
                let data = res[0];
                delete data["password"]
                result.data = data;
                response.json(result)
            }
            connection.release()
        })
    })
})

/**
 * 添加反馈
 */
router.post("/addFeedback", function (req, response) {
    let { content } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    getMysqlPool(function (connection) {
        let sql = `insert into feedback (from_user_id,content,time) values (?,?,?)`;
        connection.query(sql, [user_id, content, new Date().getTime()], function (error, res) {
            if (error) {
                console.log('netlog-', error)
                result.code = -1;
                result.data = error;
                response.json(result)
            } else {
                result.data = res[0];
                response.json(result)
            }
            connection.release()
        })
    })
})

/**
 * 添加tag标签
 */
router.post("/rss/tag", function (req, response) {
    let { name } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    getMysqlPool(function (connection) {
        let sql = `insert into tag(name,time) values (?,?)`;
        connection.query(sql, [name, new Date().getTime()], function (error, res) {
            if (error) {
                console.log('netlog-', error)
                result.code = -1;
                result.data = error;
                response.json(result)
            } else {
                response.json(result)
            }
            connection.release()
        })
    })
})

/**
 * tags 标签
 */
router.get("/rss/tag", function (req, response) {
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = "select * from tag order by orders desc"
        return beginTransaction.query(connection, sql, []);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 订阅RSS
 */
router.post("/rss/subRss", function (req, response) {
    let { id } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = "select * from sub_rss where target_rss_id = ? and target_user_id = ?"
        return beginTransaction.query(connection, sql, [id, user_id]).then(res => {
            if (res && res.length > 0) {
                return Promise.reject("你已经订阅过了～")
            } else {
                let sql = `insert into sub_rss(target_rss_id,target_user_id,time) values (?,?,?)`;
                return beginTransaction.query(connection, sql, [id, user_id, new Date().getTime()])
            }
        });
    }).then(res => {
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 取消订阅RSS
 */
router.post("/rss/unSubRss", function (req, response) {
    let { id } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = "select * from sub_rss where target_rss_id = ? and target_user_id = ?"
        return beginTransaction.query(connection, sql, [id, user_id]).then(res => {
            if (res && res.length > 0) {
                let sql = `delete from sub_rss where target_rss_id = ? and target_user_id = ?`;
                return beginTransaction.query(connection, sql, [id, user_id])
            } else {
                return Promise.reject("你还没有订阅该栏目～")
            }
        });
    }).then(res => {
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * RSS 广场推荐
 * TODO: 增加热门分组，根据订阅去排序
 */
router.get("/rss/recommend", function (req, response) {
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        //先根据tag 分组
        let sql = `select * from tag order by orders desc;`
        return beginTransaction.query(connection, sql, []).then(res => {
            if (res && res.length > 0) {
                //根据tag 查询具体的rss
                let allPromise = res.map(tag => {
                    if (tag.name == "热门") {
                        //根据订阅数量排序
                        let sql = "select target_rss_id,count(target_rss_id) as ct from sub_rss group by target_rss_id order by ct desc limit 0,10"
                        return beginTransaction.query(connection, sql, []).then(res => {
                            if (res && res.length) {
                                let allPromise = res.map(rss => {
                                    let sql = "select * from rss where rss_id = ? and enable = 1"
                                    return beginTransaction.query(connection, sql, [rss.target_rss_id]);
                                })
                                return Promise.all(allPromise).then(res => {
                                    let childArray = [];
                                    res.forEach(item => {
                                        if (item.length > 0) {
                                            childArray.push(item[0])
                                        }
                                    })
                                    return Promise.resolve({ ...tag, child: childArray })
                                })
                            } else {
                                return Promise.resolve({ ...tag, child: [] })
                            }
                        })
                    } else if (tag.name == "最新") {
                        //根据时间排序
                        let sql = "select * from rss where enable = 1 order by time desc limit 0,10"
                        return beginTransaction.query(connection, sql, []).then(res => {
                            return Promise.resolve({ ...tag, child: res })
                        })
                    } 
                    else {
                        let sql = `select * 
                            from rss r
                            where target_tag_id = ? and enable = 1 order by r.time desc limit ?,?`
                        return beginTransaction.query(connection, sql, [tag.tag_id, 0, 10]).then(res => {
                            if (res && res.length > 0) {
                                return Promise.resolve({ ...tag, child: res });
                            } else {
                                return Promise.resolve({ ...tag, child: [] });
                            }
                        })
                    }
                })
                return Promise.all(allPromise);
            } else {
                return Promise.resolve([]);
            }
        })
    }).then(res => {
        result.data = res.filter(item => item.child.length > 0);
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 全部的 RSS
 */
router.get("/rss", function (req, response) {
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select * from rss where enable = 1;`
        return beginTransaction.query(connection, sql, []);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 添加RSS
 */
router.post("/rss", function (req, response) {
    let { name, logo, description, url, target_tag_id,type = 1 } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    getMysqlPool(function (connection) {
        let sql = `insert into rss (name,logo,description,type,rss_url,target_tag_id,time) values (?,?,?,?,?,?,?)`;
        connection.query(sql, [name, logo, description, parseInt(type), url, target_tag_id, new Date().getTime()], function (error, res) {
            if (error) {
                console.log('netlog-', error)
                result.code = -1;
                result.data = error;
                response.json(result)
            } else {
                response.json(result)
            }
            connection.release()
        })
    })
})

/**
 * 模糊搜索 RSS
 */
router.post("/rss/search", function (req, response) {
    let { name, offset, limit } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select r.*
                from rss r
                where r.name like ? and r.enable = 1 order by r.time desc limit ?,?`
        return beginTransaction.query(connection, sql, [`%${name}%`, parseInt(offset), parseInt(limit)]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 模糊搜索 backupRSS
 */
router.post("/rss/backup/search", function (req, response) {
    let { name, offset, limit } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select br.*,rss.*
                from backup_rss br
                left join rss rss on rss.rss_id = br.target_rss_id and rss.enable = 1
                where br.title like ? order by br.time desc limit ?,?`
        return beginTransaction.query(connection, sql, [`%${name}%`, parseInt(offset), parseInt(limit)]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 具体tag下的 rss
 */
router.get("/tag/rss", function (req, response) {
    let { tag_id, offset, limit } = req.query;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = "select * from tag where tag_id = ?"
        return beginTransaction.query(connection, sql, [tag_id]).then(res => {
            if (res && res.length) {
                let tag = res[0]
                if (tag.name == "热门") {
                    //根据订阅数量排序
                    let sql = "select target_rss_id,count(target_rss_id) as ct from sub_rss group by target_rss_id order by ct desc limit ?,?"
                    return beginTransaction.query(connection, sql, [parseInt(offset), parseInt(limit)]).then(res => {
                        if (res && res.length) {
                            let allPromise = res.map(rss => {
                                let sql = `select r.*, case when sub.target_rss_id > 0 then true else false end as hasSub 
                                    from rss r
                                    left join sub_rss sub on sub.target_rss_id = r.rss_id and sub.target_user_id = ? 
                                    where r.rss_id = ? and r.enable = 1`
                                return beginTransaction.query(connection, sql, [user_id, rss.target_rss_id]);
                            })
                            return Promise.all(allPromise).then(res => {
                                let childArray = [];
                                res.forEach(item => {
                                    childArray.push(...item)
                                })
                                return Promise.resolve(childArray)
                            })
                        } else {
                            return Promise.resolve([])
                        }
                    })
                } else if (tag.name == "最新") {
                    let sql = `select r.*, case when sub.target_rss_id > 0 then true else false end as hasSub 
                                from rss r
                                left join sub_rss sub on sub.target_rss_id = r.rss_id and sub.target_user_id = ? 
                                where r.enable = 1 order by r.time desc limit ?,?`;
                    return beginTransaction.query(connection, sql, [user_id, parseInt(offset), parseInt(limit)])
                } else {
                    let sql = `select r.*, case when sub.target_rss_id > 0 then true else false end as hasSub 
                            from rss r 
                            left join sub_rss sub on sub.target_rss_id = r.rss_id and sub.target_user_id = ? 
                            where r.target_tag_id = ? and r.enable = 1 order by r.time desc limit ?,?`;
                    return beginTransaction.query(connection, sql, [user_id, tag_id, parseInt(offset), parseInt(limit)]);
                }
            } else {
                return Promise.resolve([])
            }
        })
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 我订阅的rss
 */
router.get("/rss/mySubRss", function (req, response) {
    let { limit, offset } = req.query;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select r.*
            from sub_rss s
            inner join rss r on r.rss_id = s.target_rss_id and r.enable = 1
            where s.target_user_id = ? order by s.time desc limit ?,?`
        return beginTransaction.query(connection, sql, [user_id, parseInt(offset), parseInt(limit)]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * rss 列表
 */
router.get("/rss/list", function (req, response) {
    let { rss_id, limit, offset } = req.query;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select br.*,case when sub.target_rss_id > 0 then true else false end as hasSub
            from backup_rss br
            left join sub_rss sub on sub.target_rss_id = br.target_rss_id and sub.target_user_id = ?
            where br.target_rss_id = ? order by br.time desc limit ?,?`
        return beginTransaction.query(connection, sql, [user_id, rss_id, parseInt(offset), parseInt(limit)]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * rssinfo
 */
router.get("/rss/info", function (req, response) {
    let { rss_id } = req.query;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select rss.*, case when sub.target_rss_id > 0 then true else false end as hasSub
                    from rss rss
                    left join sub_rss sub on sub.target_rss_id = rss.rss_id and sub.target_user_id = ?
                    where rss.rss_id = ?`
        return beginTransaction.query(connection, sql, [user_id, rss_id]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * index
 */
router.get("/index", function (req, response) {
    let { offset, limit } = req.query;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select sub.* 
                from sub_rss sub
                inner join rss r on r.rss_id = sub.target_rss_id and r.enable = 1
                where sub.target_user_id = ?`
        return beginTransaction.query(connection, sql, [user_id]).then(res => {
            if (res && res.length > 0) {
                let allPromise = res.map(item => {
                    let sql = `select b.*,r.name,r.logo,r.rss_url,r.rss_id
                            from backup_rss b
                            left join rss r on r.rss_id = b.target_rss_id and r.enable = 1
                            where b.target_rss_id = ? order by b.time desc limit ?,?`;
                    return beginTransaction.query(connection, sql, [item.target_rss_id, parseInt(offset), parseInt(limit)]);
                })
                return Promise.all(allPromise).then(res => {
                    let result = [];
                    res.map(item => {
                        item.map(i => {
                            i.timespan = formatMsgTime(i.time);
                            return i;
                        })
                        result.push(...item)
                    });
                    result.sort((a, b) => {
                        if (a.time < b.time) {
                            return 1;
                        } else if (a.time == b.time) {
                            return 0;
                        } else {
                            return -1;
                        }
                    })
                    return Promise.resolve(result)
                });
            } else {
                return Promise.resolve([]);
            }
        });
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 添加收藏
 */
router.post("/rss/collect", function (req, response) {
    let { backup_rss_id } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = "select * from collect_rss where target_backup_rss_id = ? and target_user_id = ?"
        return beginTransaction.query(connection, sql, [backup_rss_id, user_id]).then(res => {
            if (res && res.length > 0) {
                return Promise.reject("你已经收藏过了")
            } else {
                let sql = "select * from backup_rss where backup_rss_id = ?"
                return beginTransaction.query(connection, sql, [backup_rss_id])
            }
        }).then(res => {
            if (res && res.length > 0) {
                let sql = "select * from rss where rss_id = ?"
                return beginTransaction.query(connection, sql, [res[0].target_rss_id])
            } else {
                return Promise.reject("收藏失败")
            }
        }).then(res => {
            if (res && res.length > 0) {
                let sql = `insert into collect_rss(target_backup_rss_id,target_user_id,target_rss_id,time) values(?,?,?,?)`
                return beginTransaction.query(connection, sql, [backup_rss_id, user_id, res[0].rss_id, new Date().getTime()]);
            } else {
                return Promise.reject("收藏失败")
            }
        })
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 取消收藏
 */
router.delete("/rss/collect", function (req, response) {
    let { backup_rss_id } = req.query;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = "select * from collect_rss where target_backup_rss_id = ? and target_user_id = ?"
        return beginTransaction.query(connection, sql, [backup_rss_id, user_id]).then(res => {
            if (res && res.length > 0) {
                let sql = `delete from collect_rss where target_backup_rss_id = ? and target_user_id = ?`
                return beginTransaction.query(connection, sql, [backup_rss_id, user_id]);
            } else {
                return Promise.reject("你还没有收藏")

            }
        })
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})


/**
 * 我的收藏列表
 */
router.get("/rss/collect", function (req, response) {
    let { offset, limit } = req.query;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select b.*
                from collect_rss c
                left join backup_rss b on b.backup_rss_id = c.target_backup_rss_id
                where c.target_user_id = ? order by c.time desc limit ?,?`
        return beginTransaction.query(connection, sql, [user_id, parseInt(offset), parseInt(limit)]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 是否收藏
 */
router.post("/rss/collect/isCollect", function (req, response) {
    let { backup_rss_id } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select * from collect_rss where target_user_id = ? and target_backup_rss_id = ?`;
        return beginTransaction.query(connection, sql, [user_id, backup_rss_id]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})
/**
 * 用户申请rss栏目
 */
router.post("/rss/apply", function (req, response) {
    let { name, url } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `insert into apply_rss(name,rss_url,target_user_id,time) values(?,?,?,?)`;
        return beginTransaction.query(connection, sql, [name, url, user_id, new Date().getTime()]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 上报错误
 */
router.post("/rss/error", function (req, response) {
    let { target_backup_rss_id, content } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    getMysqlPool(function (connection) {
        let sql = `insert into error_backup_rss (target_backup_rss_id,target_user_id,content,time) values (?,?,?,?)`;
        connection.query(sql, [target_backup_rss_id, user_id, content, new Date().getTime()], function (error, res) {
            if (error) {
                console.log('netlog-', error)
                result.code = -1;
                result.data = error;
                response.json(result)
            } else {
                response.json(result)
            }
            connection.release()
        })
    })
})

/**
 * 系统消息列表
 */
router.get("/systemMsg", function (req, response) {
    let { offset, limit } = req.query;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `select * from system_msg order by time desc limit ?,?`
        return beginTransaction.query(connection, sql, [parseInt(offset), parseInt(limit)]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

/**
 * 系统消息列表
 */
router.post("/systemMsg", function (req, response) {
    let { text } = req.body;
    let { user_id } = req.user;
    let result = new Response();
    beginTransaction(function (connection) {
        let sql = `insert into system_msg(text,time) values(?,?)`
        return beginTransaction.query(connection, sql, [text, new Date().getTime()]);
    }).then(res => {
        result.data = res;
        response.json(result)
    }).catch(error => {
        console.log('netlog-', error)
        result.code = -1;
        result.message = error;
        response.json(result)
    })
})

router.get("/test", function (req, response) {
    response.send("sdfsdfsadf")
})



function formatMsgTime(timespan) {
    var dateTime = new Date(timespan);
    var year = dateTime.getFullYear();
    var month = dateTime.getMonth() + 1;
    var day = dateTime.getDate();
    var hour = dateTime.getHours();
    var minute = dateTime.getMinutes();
    var second = dateTime.getSeconds();
    var now = new Date();
    var now_new = now.getTime();  //typescript转换写法
    var milliseconds = 0;
    var timeSpanStr;
    milliseconds = now_new - timespan;

    if (milliseconds <= 1000 * 60 * 1) {
        timeSpanStr = '刚刚';
    }
    else if (1000 * 60 * 1 < milliseconds && milliseconds <= 1000 * 60 * 60) {
        timeSpanStr = Math.round((milliseconds / (1000 * 60))) + '分钟前';
    }
    else if (1000 * 60 * 60 * 1 < milliseconds && milliseconds <= 1000 * 60 * 60 * 24) {
        timeSpanStr = Math.round(milliseconds / (1000 * 60 * 60)) + '小时前';
    }
    else if (1000 * 60 * 60 * 24 < milliseconds && milliseconds <= 1000 * 60 * 60 * 24 * 15) {
        timeSpanStr = Math.round(milliseconds / (1000 * 60 * 60 * 24)) + '天前';
    }
    else if (milliseconds > 1000 * 60 * 60 * 24 * 15 && year == now.getFullYear()) {
        timeSpanStr = month + '-' + day + ' ' + hour + ':' + minute;
    } else {
        timeSpanStr = year + '-' + month + '-' + day + ' ' + hour + ':' + minute;
    }
    return timeSpanStr;
}

module.exports = router;