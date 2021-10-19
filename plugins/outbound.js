var fs = require('fs');
var http = require('http');
var https = require('https');
const config = require('../config.json');


exports.register = function() {
  this.register_hook('send_email', 'send_email');
  this.register_hook('deferred', 'mail_deferred');
  this.register_hook('bounce', 'mail_bounced');
  this.register_hook('delivered', 'mail_delivered');
};

exports.send_email = function (next, hmail) {
  this.loginfo('Email Queued');
  this.loginfo(hmail.path);
  this.loginfo(hmail.notes);
  this.loginfo(hmail.num_failures);
  var plugin = this;
  if (hmail.notes['token'] == null) {
    searchFull(hmail.path, 'X-Callback-Token').then(function (res) {
      if (res != null) {
        res = res.replace('X-Callback-Token: ', '');
        res = res.replace(/\r/, '');
        plugin.loginfo(res);
        hmail.notes = { 'token' : res };
      }
    });
  }
  next();
};

exports.mail_deferred = function (next, hmail, params) {
  this.loginfo('Email deferred');
  this.loginfo(params);
  next(OK);
};

exports.mail_bounced = function (next, hmail, err) {
  this.loginfo('Email bounced');
  // this.loginfo("START");
  var log = this;
  var addresses = hmail.todo.rcpt_to;
  for (const address of addresses) {
    log.loginfo(address);
    log.loginfo(hmail.notes);
    emailDeliveryCallBack({ 'token': hmail.notes['token'], 'rcpt': address.original, 'bounced': true, 'msg': address.reason });
  }
  next();
};

exports.mail_delivered = function (next, hmail, params) {
  this.loginfo('Email delivered');
  var log = this;
  var addresses = hmail.todo.rcpt_to;
  this.loginfo(hmail.notes);
  for (const address of addresses) {
    log.loginfo(address.original);
    emailDeliveryCallBack({ 'token': hmail.notes['token'], 'rcpt': address.original, 'delivered': true });
  }
  next();
};


const searchFull = (filepath, text) => {
  return new Promise((resolve) => {
    const regEx = new RegExp(text, "i");
    var result = [];
    fs.readFile(filepath, 'utf8', function (err, contents) {
      let lines = contents.toString().split("\n");
      lines.forEach(line => {
        if (line && line.search(regEx) >= 0) {
          result.push(line);
          return false;
        }
      });
      resolve(result[0]);
    })
  });
}

const serialize = function (obj) {
  var str = [];
  for (var p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
}

const emailDeliveryCallBack = (params) => {
  var url = config.webhook_url + '/email_delivery/report_callback?' + serialize(params);
  var req = http;
  if (url.indexOf('https://') != -1){
    req = https;
  }

  req.get(url, (res) => {
    // console.log('STATUS: ' + res.statusCode);
    res.on('data', function (chunk) {
      // console.log('BODY: ' + chunk);
    });
  });
}
