/**
 * 定时任务同步rss到本地数据库
 */
var fastXmlParser = require('fast-xml-parser');
var schedule = require('node-schedule');
var request = require('request')
const scheduleCronstyle = () => {
    //每半小时触发一次同步更新
    // schedule.scheduleJob('0 0 * * * *', () => {
    //     syncSql();
    // });

    setInterval(() => {
        syncSql();
    }, 1000 * 60 * 10);
}
scheduleCronstyle();

var {getMysqlPool, beginTransaction } = require("../db/db")

var startInsertMySql = totalItems => {
    beginTransaction(connection => {
        return Promise.all(totalItems.map((item, index) => {
            return new Promise((resover, reject) => {
                if(!item.title || !item.link){
                    resover("")
                    return;
                }
                //插入之前需要查询是否存在，防止数据重复，维度为 title link rss_id
                let sql = "select * from backup_rss where title =? and link =?"
                connection.query(sql, [item.title, item.link], function (error, result) {
                    if (error) {
                        resover("")
                    } else if (result && result.length == 0) {
                        //不存在,开始插入数据
                        let sql = `insert into backup_rss(target_rss_id,title,link,time) values(?,?,?,?)`;
                        connection.query(sql, [item.rss.rss_id, item.title, item.link, item.date], function (error, res) {
                            resover("")
                        })
                    }else{
                        resover("")
                    }
                })
            });
        }));
    }).then(res => {
        console.log('neltog-所有数据同步完成')
        totalItems.length = 0;
    }).catch(error => {
        console.log('neltog-',error)
    })
}

var requestXMLandParder = rssResult => {
    let totalItems = [];
    let count = 0;
    rssResult.forEach(rss => {
        let url = encodeURI(rss.rss_url);
        //request url
        request.get(url, { timeout: 1000 * 60 }, (error, response) => {
            count++;
            if (count >= rssResult.length - 1) {
                count = 0;
                startInsertMySql(totalItems);
            }
            if (!error && response.statusCode == 200) {
                //parser xml
                let json = fastXmlParser.parse(response.body)
                if (json && json.rss && json.rss.channel && json.rss.channel.item && json.rss.channel.item.length > 0) {
                    let lastBuildDate = json.rss.channel.lastBuildDate;
                    json.rss.channel.item.forEach(item => {
                        item.rss = rss;
                        item.date = item.pubdate && item.pubdate.length > 5 ? new Date(item.pubdate).getTime()
                            : lastBuildDate && lastBuildDate.length > 5 ? new Date(lastBuildDate).getTime()
                                : new Date().getTime()
                    });
                    //添加到集合，稍后统一插入数据库
                    totalItems.push(...json.rss.channel.item)
                }
            }
        })
    });
}

var syncSql = async () => {
    getMysqlPool(function (connection) {
        //查询所有的rss栏目
        let sql = "select * from rss where enable = 1";
        connection.query(sql, [], function (error, res) {
            if (!error) {
                requestXMLandParder(res);
            }
            connection.release();
        })
    });
}

// syncSql();


// function updateRssUrl() {
//     beginTransaction(connection => {
//         let sql = "select * from rss;"
//         return beginTransaction.query(connection, sql, []).then(res => {
//             if (res && res.length > 0) {
//                 let allPromise = res.map(item => {
//                     let sql = "update rss set rss_url = ? where rss_id = ?"
//                     let url = item.rss_url.replace("http://192.168.0.204:1200", "http://rsshub.app")
//                     return beginTransaction.query(connection, sql, [url, item.rss_id])
//                 })
//                 return Promise.all(allPromise);
//             }
//         })
//     })
// }

