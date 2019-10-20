function filterEmoji(str){
    return unescape(escape(str).replace(/\%uD.{3}/g, ''));
}

module.exports = {
    filterEmoji
}