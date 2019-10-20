var mysql = require('mysql')

var mysqlPool = mysql.createPool({
    acquireTimeout: 60,
    waitForConnections: true,
    connectionLimit: 200,
    user: "root",
    host: "172.17.97.19",//更改为自己的数据库ip，本地的为localhost
    password: "xxxxxxxx",//数据库密码
    port: 3306,
    database: "vjujiao"
})

function getMysqlPool(callback) {
    mysqlPool.getConnection(function (error, connection) {
        if (error) {
            console.log('netlog-getConnection',error)
            throw error
        } else {
            callback && callback(connection)
        }
    })
}

var beginTransaction = (tran) => {
    return new Promise((resolve, reject) => {  //返回promise提供事务成功与失败的接口
        getMysqlPool((conn) => {
            conn.beginTransaction((err) => { //开始事务处理
                if (err) {
                    conn.release()
                    reject(err)
                } else {
                    let promise = tran(conn)  //调用事务处理函数
                    promise.then(result => {
                        conn.commit(err => {  //事务处理函数resolve则提交事务
                            if (err) {
                                reject(err)
                            } else {
                                resolve(result)
                            }
                            conn.release()
                        })
                    }).catch(err => {
                        conn.rollback(() => {  //事务处理函数reject则回滚事务
                            conn.release()
                            reject(err)
                        })
                    })
                }
            })
        })
    })
}

beginTransaction.query = (conn, sql, params) => {
    return new Promise((resolve, reject) => {
        conn.query(sql, params, (err, result) => {
            if (err) {
                reject(err)
            } else {
                resolve(result)
            }
        })
    })
}

module.exports = {
    getMysqlPool,
    beginTransaction,
}