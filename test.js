const dns = require("dns");

dns.lookup("mysql-2751d455-dms-db4.h.aivencloud.com", (err, address) => {
  if (err) {
    console.log("DNS Error:", err);
  } else {
    console.log("Resolved IP:", address);
  }
});