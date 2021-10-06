var fs = require('fs');
var https = require('https');


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
  this.loginfo("START");
  this.loginfo(hmail.todo.rcpt_to);
  this.loginfo(hmail.notes);
  this.loginfo(err);
  this.loginfo(err.mx);
  this.loginfo(err.deferred_rcpt);
  this.loginfo(err.bounced_rcpt);
  this.loginfo("END");
  emailDeliveryCallBack({ 'token': hmail.notes['token'], 'rcpt': hmail.todo.rcpt_to[0].original, 'bounced': true });
  next();
};

exports.mail_delivered = function (next, hmail, params) {
  this.loginfo('Email delivered');
  this.loginfo(hmail.path);
  this.loginfo(hmail.notes);
  this.loginfo(hmail.todo.rcpt_to[0].original);
  this.loginfo("END");
  emailDeliveryCallBack({ 'token': hmail.notes['token'], 'rcpt': hmail.todo.rcpt_to[0].original, 'delivered': true });
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
  var url = 'https://hodor.free.beeceptor.com/mail-delivery?' + serialize(params);

  https.get(url, (res) => {
    console.log('STATUS: ' + res.statusCode);
    res.on('data', function (chunk) {
      console.log('BODY: ' + chunk);
    });
  });
}
