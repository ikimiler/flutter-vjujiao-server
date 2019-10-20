# flutter-vjujiao-server

此仓库为flutter-vjujiao的后台支撑代码，主要技术为node+mysql

service 服务与app的接口，如用户，rss订阅源
taskservice 用于定时同步所采集的rss订阅源数据到数据库

说明：rss订阅源采集了rsshub上的数据源

如果需要跑该套代码请先行在代码处修改为自己的mysql的配置：

  1.service/db/db.js 第八行
  2.taskservice/db/db.js 第八行
  3.分别复制service/db/db.sql和taskservice/db/db.sql的代码，用于创建数据表
