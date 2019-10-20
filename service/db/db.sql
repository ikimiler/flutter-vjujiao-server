
create database vjujiao default character set utf8;

/**
* 用户表 sex 1 男 0 女 status 0 开启 1 禁用 role 角色
*/
create table if not exists user(
    user_id int primary key auto_increment, 
    email varchar(100) unique,
    password varchar(500),
    sex int default 1, 
    name varchar(50),
    avatar_url varchar(500),
    intro varchar(500), 
    status int default 0, 
    role int default 0,
    time long 
) DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

/**
* 标签类型
*/
create table if not exists tag(
    tag_id int primary key auto_increment, 
    name varchar(500) unique,
    orders int default 1,
    time long 
) DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

/**
* RSS enable 1开启 0关闭
*/
create table if not exists rss(
    rss_id int primary key auto_increment, 
    enable int default 1,
    name varchar(500) unique,
    logo text,
    description text,
    rss_url varchar (500),
    time long,
    target_tag_id int,
    type int DEFAULT 1,
    foreign key (target_tag_id) references tag(tag_id) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;


/**
* RSS订阅
*/
create table if not exists sub_rss(
    sub_rss_id int primary key auto_increment, 
    target_rss_id int,
    target_user_id int,
    time long ,
    foreign key (target_rss_id) references rss(rss_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    foreign key (target_user_id) references user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

/**
* 反馈
*/
create table if not exists feedback(
    feedback_id int primary key auto_increment, 
    from_user_id int,
    content varchar(500),
    time long ,
    foreign key (from_user_id) references user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

/**
* sync rss to mysql
*/
create table if not exists backup_rss(
    backup_rss_id int primary key auto_increment,
    target_rss_id int,
    title varchar(500),
    link varchar(500),
    time long ,
    foreign key (target_rss_id) references rss(rss_id) ON UPDATE CASCADE ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

/**
* 安全码
*/
create table if not exists email_code(
    email_code_id int primary key auto_increment,
    email varchar(500),
    code int,
    time long
)DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

/**
* 申请栏目
*/
create table if not exists apply_rss(
    apply_rss_id int primary key auto_increment,
    name varchar(500),
    rss_url varchar(500),
    target_user_id int,
    time long,
    foreign key (target_user_id) references user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
)DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

/**
* 添加收藏
*/
create table if not exists collect_rss(
    collect_rss_id int primary key auto_increment,
    target_backup_rss_id int,
    target_rss_id int,
    target_user_id int,
    time long,
    foreign key (target_user_id) references user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    foreign key (target_backup_rss_id) references backup_rss(backup_rss_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    foreign key (target_rss_id) references rss(rss_id) ON UPDATE CASCADE ON DELETE RESTRICT
)DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

/**
* 上报错误
*/
create table if not exists error_backup_rss(
    error_backup_rss_id int primary key auto_increment,
    target_backup_rss_id int,
    target_user_id int,
    content text,
    time long,
    foreign key (target_user_id) references user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    foreign key (target_backup_rss_id) references backup_rss(backup_rss_id) ON UPDATE CASCADE ON DELETE RESTRICT
)DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

/**
* 系统消息
*/
create table if not exists system_msg(
    system_msg_id int primary key auto_increment,
    text text,
    time long
)DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;
