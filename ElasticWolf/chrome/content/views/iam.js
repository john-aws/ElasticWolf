
var ew_UsersTreeView = {
    model: [ "users", "groups"],

    menuChanged: function() {
        var item = this.getSelected();
        $("ew.users.contextmenu.delete").disabled = !item;
        $("ew.users.contextmenu.addGroup").disabled = !item;
        $("ew.users.contextmenu.addPassword").disabled = !item || (item.loginProfileDate && !this.core.isGovCloud());
        $("ew.users.contextmenu.changePassword").disabled = !item || (!item.loginProfileDate && !this.core.isGovCloud());
        $("ew.users.contextmenu.deletePassword").disabled = !item || (!item.loginProfileDate && !this.core.isGovCloud());
        $("ew.users.contextmenu.createKey").disabled = !item;
        $("ew.users.contextmenu.deleteKey").disabled = !item || !item.accessKeys || !item.accessKeys.length;
        $("ew.users.contextmenu.enableVMFA").disabled = !item;
        $("ew.users.contextmenu.enableMFA").disabled = !item;
        $("ew.users.contextmenu.resyncMFA").disabled = !item || !item.mfaDevices || !item.mfaDevices.length;
        $("ew.users.contextmenu.deactivateMFA").disabled = !item || !item.mfaDevices || !item.mfaDevices.length;
        $("ew.users.contextmenu.addPolicy").disabled = !item;
        $("ew.users.contextmenu.editPolicy").disabled = !item || !item.policies || !item.policies.length;
        $("ew.users.contextmenu.deletePolicy").disabled = !item || !item.policies || !item.policies.length;
    },

    makeKeypair: function(uploadCert)
    {
        var item = this.getSelected();
        if (!item) return;
        ew_KeypairsTreeView.makeKeypair(uploadCert, item.name);
    },

    selectionChanged: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.updateUser(item);
    },

    updateUser: function(item)
    {
        var me = this;
        // GovCloud does not support this yet
        if (!item.loginProfileDate && !this.core.isGovCloud()) {
            this.core.api.getLoginProfile(item.name, function(date) { me.menuChanged() })
        }
        if (!item.groups) {
            this.core.api.listGroupsForUser(item.name, function(list) { me.menuChanged() })
        }
        if (!item.policies) {
            this.core.api.listUserPolicies(item.name, function(list) { me.menuChanged() })
        }
        if (!item.accessKeys) {
            this.core.api.listAccessKeys(item.name, function(list) { me.menuChanged() })
        }
        if (!item.mfaDevices) {
            this.core.api.listMFADevices(item.name, function(list) { me.menuChanged() })
        }
    },

    addUser: function()
    {
        var me = this;
        var values = this.core.promptInput('Create User', [{ label: "User Name",required:1}, { label: "Path"} ]);
        if (values) {
            this.core.api.createUser(values[0], values[1], function(user) {
                me.core.addModel('users', user);
                me.invalidate();
                me.select(user)
            })
        }
    },

    deleteUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm("Delete user?")) return;
        this.core.api.deleteUser(item.name, function() {
            if (me.core.removeModel('users', item.name, 'name')) me.invalidate(); else me.refresh();
        });
    },

    renameUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Rename User', [{label: "New User Name", value: item.name} , {label: "New Path", value: item.path} ]);
        if (!values) return;
        this.core.api.updateUser(item.name, values[0] != item.name ? values[0] : null, values[1] != item.path ? values[1] : null, function() {
            me.core.updateModel('users', item.name, 'name', values[0], 'path', values[1]);
            me.invalidate();
        })
    },

    setPassword: function(update)
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Set Password', [{ label: "New Password", type: "password" }, { label: "Retype Password", type: "password" }]);
        if (!values) return;
        if (values[0] != values[1]) {
            return alert('New entered passwords mismatch')
        }
        if (update) {
            this.core.api.updateLoginProfile(item.name, values[0], function() { })
        } else {
            this.core.api.createLoginProfile(item.name, values[0], function() { item.loginProfileDate = new Date(); })
        }
    },

    changePassword: function()
    {
        var values = this.core.promptInput('Change AWS Console Password', [{ label: "Old Password", type: "password" }, { label: "New Password", type: "password" }, { label: "Retype Password", type: "password" }]);
        if (!values) return;
        if (values[1] != values[2]) {
            return alert('New entered passwords mismatch')
        }
        return
        this.core.api.changePassword(values[0], values[1], function() { alert("AWS Console password has been changed") })
    },

    deletePassword: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm("Delete password for user " + item.name + "?")) return;
        this.core.api.deleteLoginProfile(item.name, function() {
            item.loginProfileDate = null;
        });
    },

    addGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var list = this.core.queryModel('groups');
        var idx = this.core.promptList("Group", "Select group to add this user to", list, ["name"]);
        if (idx < 0) return;
        this.core.api.addUserToGroup(item.name, list[idx].name, function() {
            item.groups = null;
            me.selectionChanged();
        });
    },

    addPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Policy', [{label:"Policy name",type:"name",required:1},
                                                      {label:"Policy Permissions",multiline:true,cols:50,rows:20,required:1,value:'{\n "Statement": [\n  { "Effect": "Allow",\n    "Action": "*",\n    "Resource": "*"\n  }\n ]\n}'}]);
        if (!values) return;
        this.core.api.putUserPolicy(item.name, values[0], values[1], function() {
            item.policies = null;
            me.selectionChanged();
        });
    },

    editPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return alert('No policies to edit');
        }
        var idx = 0;

        if (item.policies.length > 1) {
            idx = this.core.promptList("Policy", "Select policy to edit", item.policies);
            if (idx < 0) return;
        }

        this.core.api.getUserPolicy(item.name, item.policies[idx], function(doc) {
            var text = me.core.promptForText('Enter policy permissions', doc);
            if (text) {
                this.core.api.putUserPolicy(item.name, item.policies[idx], text);
            }
        });
    },

    deletePolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return alert('No policies to delete');
        }
        var idx = 0;

        if (item.policies.length > 0) {
            idx = this.core.promptList("Policy", "Select policy to delete", item.policies);
            if (idx < 0) return;
        } else {
            if (!confirm('Delete policy ' + item.policies[idx] + '?')) return;
        }
        this.core.api.deleteUserPolicy(item.name, item.policies[idx], text, function() {
            item.policies = null;
            me.selectionChanged();
        });
    },

    createAccessKey: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.core.api.createAccessKey(item.name, function(key) {
            item.accessKeys = null;
            me.selectionChanged();
            ew_AccessKeysTreeView.showAccessKey(key.id, key.secret);
        });
    },

    deleteAccessKey: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.accessKeys || !item.accessKeys.length) {
            return alert('No access keys');
        }
        var idx = 0;

        if (item.accessKeys.length > 0) {
            idx = this.core.promptList("Access Key", "Select access key to delete", item.accessKeys);
            if (idx < 0) return;
        } else {
            if (!confirm('Delete access key ' + item.accessKeys[idx] + '?')) return;
        }
        this.core.api.deleteAccessKey(item.accessKeys[idx].id, item.name, function() {
            item.accessKeys = null;
            me.selectionChanged();
        });
    },

    createVMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        this.core.api.createVirtualMFADevice(item.name, null, function(obj) {
            var png = "data:image/png;base64," + obj.qrcode;
            values = me.core.promptInput('Activate MFA device', [{label:"Serial",value:obj.id,type:'label'}, {label:"QRCode",value:png,type:'image',fixed:true,minheight:300,maxheight:300,minwidth:300,maxwidth:300,height:300,width:300}, {label:"Secret Key",value:obj.seed,type:'label'}, {label:"Auth Code 1",required:1}, {label:"Auth Code 2",required:1}]);
            if (!values) return;
            this.core.api.enableMFADevice(item.name, obj.id, values[3], values[4], function() {
                item.mfaDevices = null;
                me.selectionChanged();
            });
        });
    },

    enableMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Activate MFA device', [{label:"Serial Number",required:1}, {label:"Auth Code 1",required:1}, {label:"Auth Code 2",required:1}]);
        if (!values) return;
        this.core.api.enableMFADevice(item.name, values[0], values[1], values[2], function() {
            item.mfaDevices = null;
            me.selectionChanged();
        });
    },

    resyncMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.mfaDevices || !item.mfaDevices.length) {
            return alert('No devices to resync');
        }
        var values = this.core.promptInput('Resync MFA device', [{label:"Serial Number",required:1}, {label:"Auth Code 1",required:1}, {label:"Auth Code 2",required:1}]);
        if (!values) return;
        this.core.api.resyncMFADevice(item.name, values[0], values[1], values[2], function() {
            item.mfaDevices = null;
            me.selectionChanged();
        });
    },

    deactivateMFA: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.mfaDevices || !item.mfaDevices.length) {
            return alert('No device to delete');
        }

        if (item.mfaDevices.length > 0) {
            idx = this.core.promptList("MFA Device", "Select device to deactivate", item.mfaDevices);
            if (idx < 0) return;
        } else {
            if (!confirm('Deactivate MFA device ' + item.mfaDevices[idx] + '?')) return;
        }
        this.core.api.deactivateMFADevice(item.name, item.mfaDevices[idx].id, function() {
            // Remove Virtual MFA device
            if (item.mfaDevices[idx].id.indexOf('arn:aws') == 0) {
                this.core.api.deleteVirtualMFADevice(item.mfaDevices[idx].id);
            }
            item.mfaDevices = null;
            me.selectionChanged();
        });
    },

};


var ew_GroupsTreeView = {
    model: ["groups","users"],

    menuChanged: function() {
        var item = this.getSelected();
        $("ew.groups.contextmenu.delete").disabled = !item;
        $("ew.groups.contextmenu.rename").disabled = !item;
        $("ew.groups.contextmenu.addPolicy").disabled = !item;
        $("ew.groups.contextmenu.editPolicy").disabled = !item || !item.policies || !item.policies.length;
        $("ew.groups.contextmenu.deletePolicy").disabled = !item || !item.policies || !item.policies.length;
    },

    selectionChanged: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;

        if (item.users) {
            ew_GroupUsersTreeView.display(item.users);
        } else {
            this.core.api.getGroup(item.name, function(group) { ew_GroupUsersTreeView.display(group.users); });
        }
        if (!item.policies) {
            this.core.api.listGroupPolicies(item.name, function(list) { me.menuChanged() })
        }
    },

    addUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var users = this.core.queryModel('users');
        var list = [];
        for (var i in users) {
            var found = false
            for (var j in item.users) {
                if (users[i].name == item.users[j].name) {
                    found = true;
                    break;
                }
            }
            if (!found) list.push(users[i]);
        }
        var idx = this.core.promptList("User name", "Select user to add to " + item.name, list);
        if (idx < 0) return;
        this.core.api.addUserToGroup(users[idx].name, item.name, function() {
            item.users = null;
            me.invalidate();
        });
    },

    deleteUser: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var user = ew_GroupUsersTreeView.getSelected()
        if (!user) return;
        if (!confirm("Remove user " + user.name + " from group " + item.name + "?")) return;
        this.core.api.removeUserFromGroup(user.name, item.name, function() {
            item.users = null;
            me.invalidate();
        });
    },

    addGroup: function()
    {
        var me = this;
        var values = this.core.promptInput('Create Group', [{label:"Group Name",required:1}, {label:"Path"}]);
        if (values) {
            this.core.api.createGroup(values[0], values[1], function(group) {
                me.core.addModel('groups', group);
                me.invalidate();
                me.select(group);
            })
        }
    },

    deleteGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm("Delete group?")) return;
        this.core.api.deleteGroup(item.name, function() {
            me.core.removeModel('groups', item.name, 'name');
            me.invalidate();
        });
    },

    renameGroup: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Rename Group', [{label:"New Group Name"}, {label:"New Path"}], [ item.name, item.path ]);
        if (!values) return;
        this.core.api.updateGroup(item.name, values[0] != item.name ? values[0] : null, values[1] != item.path ? values[1] : null, function() {
            me.core.updateModel('groups', item.name, 'name', values[0], 'path', values[1]);
            me.invalidate();
        })
    },

    addPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Policy', [{label:"Policy name",type:"name",required:1},
                                                      {label:"Policy Permissions",multiline:true,cols:50,rows:20,required:1,value:'{\n "Statement": [\n  { "Effect": "Allow",\n    "Action": "*",\n    "Resource": "*"\n  }\n ]\n}'}]);
        if (!values) return;
        this.core.api.putGroupPolicy(item.name, values[0], values[1], function() {
            item.policies = null;
            me.invalidate();
        });
    },

    editPolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return alert('No policied to edit');
        }
        var idx = 0;
        if (item.policies.length > 1) {
            idx = this.core.promptList("Policy", "Select policy to edit", item.policies);
            if (idx < 0) return;
        }

        this.core.api.getGroupPolicy(item.name, item.policies[idx], function(doc) {
            var text = me.core.promptForText('Enter policy permissions', doc);
            if (text) {
                this.core.api.putGroupPolicy(item.name, item.policies[idx], text);
            }
        });
    },

    deletePolicy: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.policies || !item.policies.length) {
            return alert('No policies to delete');
        }
        var idx = 0;

        if (item.policies.length > 1) {
            idx = this.core.promptList("Policy", "Select policy to delete", item.policies);
            if (idx < 0) return;
        } else
        if (!confirm('Delete policy ' + item.policies[idx])) return;

        this.core.api.deleteGroupPolicy(item.name, item.policies[idx], text, function() {
            item.policies = null;
            me.selectionChanged();
        });
    },
};


var ew_GroupUsersTreeView = {
    name: "groupUsers",

    selectionChanged: function()
    {
        var item = this.getSelected();
        if (!item) return;
        // Non visible views do not get updates so if we never show users list we need to update manually
        if (ew_UsersTreeView.rowCount > 0) {
            ew_UsersTreeView.select(item);
        } else {
            var user = this.core.findModel('users', item.id);
            if (user) {
                ew_UsersTreeView.updateUser(user);
            }
        }
    },
};

var ew_KeypairsTreeView = {
    model: ["keypairs"],

    createKeypair : function ()
    {
        if (this.core.isGovCloud()) {
            alert("This function is disabled in GovCloud region")
            return
        }
        var name = prompt("Please provide a new keypair name");
        if (name == null) return;
        name = name.trim();
        var me = this;
        this.core.api.createKeypair(name, function(keypair) {
            // Save key in the file
            var file = me.core.getPrivateKeyFile(name);
            var fp = FileIO.open(file)
            FileIO.write(fp, keypair.material + "\n\n", "");
            me.refresh();
            me.core.alertDialog('Keypair Created', 'KeyPair ' + name + ' is saved in the ' + file);
        });
    },

    importKeypair : function ()
    {
        var name = prompt("Please provide a new keypair name");
        if (name == null) return;
        name = name.trim();
        var me = this;
        // Create new private key file using openssl and return key value
        var file = this.core.promptForFile("Select the public key file to upload:")
        if (file) {
            var body = readPublicKey(file)
            if (body == '') {
                return alert('Unable to read public key file ' + file);
            }
            this.core.api.importKeypair(name, body, function() { me.refresh() });
        }
    },

    // If user is specified we create cet/keypair on behalf of that user, for keypair it does not matter,
    // they go by name but for ceetificate we need valid user name
    makeKeypair: function(uploadCert, user)
    {
        var name = prompt("Please provide a new keypair name:", user || "");
        if (name == null) return;
        name = name.trim();
        var me = this;

        if (!this.core.getKeyHome()) {
            var file = this.core.promptForDir("Choose where to store keys and certificate or Cancel to use " + this.core.getKeyHome(), true)
            if (file) {
                this.setStrPrefs("ew.key.home", file);
            }
        }

        // Create new certificate file using openssl and return cert value
        var body = this.core.generateCertificate(name);
        if (!body) {
            return alert("Could not create certificate and key pair files");
        }
        // For signing in command line tools we need at least one certificate
        if (uploadCert) {
            ew_CertsTreeView.upload(body, user);
        }

        // Import new public key as new keypair
        var file = this.core.getPublicKeyFile(name);
        var pubkey = readPublicKey(file);
        if (pubkey == '') {
            return alert('Unable to read public key file ' + file);
        }
        this.core.api.importKeypair(name, pubkey, function() {me.refresh();});
    },

    deleteSelected  : function ()
    {
        var keypair = this.getSelected();
        if (keypair == null) return;
        if (!confirm("Delete key pair "+keypair.name+"?")) return;
        var me = this;
        this.core.api.deleteKeypair(keypair.name, function() {me.refresh();});
    },
};


var ew_AccessKeysTreeView = {
    model: "accesskeys",
    properties: ["state"],

    activate: function()
    {
        TreeView.activate.call(this);
        this.select({ id: this.core.accessKey });
    },

    filter: function(list)
    {
        list = list.concat(this.getTempKeys());

        var now = new Date();
        for (var i in list) {
            list[i].state = this.core.api.accessKey == list[i].id ? "Current" : "";
            if (list[i].status == "Temporary" && list[i].expire < now) list[i].state = "Expired";
        }
        return TreeView.filter.call(this, list);
    },

    createTemp: function()
    {
        var me = this;
        var rc = {};
        openDialog('chrome://ew/content/dialogs/create_temp_accesskey.xul', null, 'chrome,centerscreen,modal', this.core, rc);
        if (!rc.ok) return;

        switch (rc.type) {
        case 'session':
            this.core.api.getSessionToken(rc.duration, function(key) {
                me.saveTempKeys(me.getTempKeys().concat([ key ]));
                me.refresh();
            });
            break;

        case 'federation':
            this.core.api.getFederationToken(rc.duration, rc.name, rc.policy, function(key) {
                me.saveTempKeys(me.getTempKeys().concat([ key ]));
                me.refresh();
            });
            break;
        }
    },

    runShell: function()
    {
        var accesskey = this.getSelected();
        if (accesskey) {
            accesskey.secret = this.getAccessKeySecret(accesskey.id);
            if (!accesskey.secret) alert('Cannot get secret for the access key, AWS command line tools will not work');
        }
        // Use currently selected keypair
        var keypair = ew_KeypairsTreeView.getSelected();
        this.core.launchShell(keypair, accesskey);
    },

    selectionChanged: function()
    {
        var key = this.getSelected();
        if (key == null || key.secret) return;
        key.secret = this.getAccessKeySecret(key.id);
        TreeView.selectionChanged.call(this);
    },

    showAccessKey: function(key, secret)
    {
        var text = 'AccessKeyId: ' + key + '\nAccessSecretKey: ' + secret;
        alert('Access Key is ready:\n' + text);
        this.core.copyToClipboard(text);
    },

    createAccessKey : function () {
        var me = this;
        this.core.api.createAccessKey(null, function(key) {
            me.refresh()
            me.showAccessKey(key.id, key.secret);
        });
    },

    getAccessKeySecret : function(key) {
        var secret = this.core.getPassword('AccessKey:' + key)
        if (secret == "" && key == this.core.api.accessKey) {
            secret = this.core.api.secretKey
        }
        return secret
    },

    getTempKeys: function()
    {
        var list = [];
        var keys = this.core.getPassword("ew.temp.keys");
        try { list = JSON.parse(keys); } catch(e) {};
        for (var i in list) {
            list[i] = new TempAccessKey(list[i].id, list[i].secret, list[i].securityToken, list[i].expire, list[i].userName, list[i].userId, list[i].arn);
        }
        return list;
    },

    saveTempKeys: function(list)
    {
        list = JSON.stringify(list instanceof Array ? list : []);
        this.core.savePassword("ew.temp.keys", list);
    },

    deleteSelected  : function () {
        var key = this.getSelected();
        if (key == null) return;
        if (key.state == "Current") {
            alert("You cannot delete current access key")
            return;
        }
        if (!this.core.promptYesNo("Confirm", "Delete access key "+key.id+"?")) return;

        if (key.status == "Temporary") {
            var list = this.getTempKeys();
            this.core.removeObject(list, key.id);
            this.saveTempKeys(list);
            this.refresh();
            return;
        }

        var me = this;
        var wrap = function() {
            this.core.deletePassword('AccessKey:' + key.id)
            me.refresh();
        }
        this.core.api.deleteAccessKey(key.id, null, wrap);
    },

    exportSelected  : function () {
        var key = this.getSelected();
        if (key == null) return;
        if (!key.secret) key.secret = this.getAccessKeySecret(key.id)
        if (key.secret == "") {
            alert("No secret key available for this access key")
            return
        }
        var path = this.core.promptForFile("Choose file where to export this access key", true)
        if (path) {
            FileIO.write(FileIO.open(path), "AWSAccessKeyId=" + key.id + "\nAWSSecretKey=" + key.secret + "\n")
        }
    },

    switchCredentials  : function () {
        var key = this.getSelected();
        if (key == null) return;
        if (!key.secret) key.secret = this.getAccessKeySecret(key.id)
        if (key.secret == "") {
            alert("Access key " + key.id + " does not have secret code available, cannot use this key");
            return;
        }
        if (!this.core.promptYesNo("Confirm", "Use access key " + key.id + " for authentication for user " + key.useName + "?, current access key/secret will be discarded.")) return;
        this.core.setCredentials(key.id, key.secret);
        // Update current credentials record with new access key but keep current endpoint
        this.core.updateCredentials(this.core.getActiveCredentials(), key.id, key.secret, null, key.securityToken);
        this.refresh();
    },
};

var ew_CertsTreeView = {
    model: "certs",

    createCert : function () {
        var me = this;
        var body = this.core.generateCertificate();
        if (body) {
            this.upload(body);
        } else {
            alert("Could not generate new X509 certificate")
        }
    },

    upload: function(body, user)
    {
        // Delay to avoid "not valid yet" error due to clock drift
        var me = this;
        setTimeout(function() { this.core.api.uploadSigningCertificate(user, body, function() { me.refresh();}); }, 30000);
    },

    uploadCert : function (user) {
        var me = this;
        var file = this.core.promptForFile("Select the certificate file to upload:")
        if (file) {
            var body = FileIO.toString(file);
            this.core.api.uploadSigningCertificate(user, body, function() { me.refresh(); });
        }
    },

    saveCert : function () {
        var item = this.getSelected();
        if (item == null) return;
        var file = this.core.promptForFile("Select the file to save certificate to:", true, DirIO.fileName(this.core.getCertificateFile(item.userName)))
        if (file) {
            FileIO.write(FileIO.open(file), item.body);
        }
    },

    deleteCert  : function () {
        var item = this.getSelected();
        if (item == null) return;
        if (!confirm("Delete certificate "+item.id+"?")) return;

        var me = this;
        this.core.api.deleteSigningCertificate(item.id, function() { me.refresh(); });
    },
};

var ew_ServerCertsTreeView = {
    model: "serverCerts",

    createCert : function () {
        var me = this;
        var values = this.core.promptInput("Server Certificate", [{label:"Certificate Name (must be unique):",required:1},{label:"Path"}]);
        if (!values) return;
        var body = this.core.generateCertificate(values[0]);
        if (!body) return alert("Could not generate new X509 certificate");
        var pkey = FileIO.toString(this.getPrivateKeyFile(values[0]));
        if (!pkey) return alert("Could not read provate key file");
        alert('The server certificate ' + values[0] + ' was created and will be uploaded within 30 seconds to avoid errors related to difference between AWS server and your computer clocks...');

        setTimeout(function() { this.core.api.uploadServerCertificate(values[0], body, pkey, values[1], null, function() { me.refresh() }); }, 30000);
    },

    uploadCert : function (user) {
        var me = this;
        var values = this.core.promptInput("Server Certificate", [{label:"Certificate Name (must be unique):",required:1},{label:"Path"},{label:"Certificate PEM file",type:"file",required:1},{label:"Private Key PEM file:",type:"file",required:1},{label:"Certificate chain PEM file:",type:"file"}]);
        if (!values) return;
        var body = FileIO.toString(values[2]);
        var pkey = FileIO.toString(values[3]);
        var chain = FileIO.toString(values[4]);
        this.core.api.uploadServerCertificate(values[0], body, pkey, values[1], chain, function() { me.refresh(); });
    },

    saveCert : function () {
        var item = this.getSelected();
        if (item == null) return;
        var file = this.core.promptForFile("Select the file to save certificate to:", true, item.name + ".pem");
        if (file) {
            this.core.api.getServerCertificate(item.name, function(obj) {
                FileIO.write(FileIO.open(file), obj.body);
            });
        }
    },

    deleteCert  : function () {
        var item = this.getSelected();
        if (item == null) return;
        if (!confirm("Delete certificate "+item.id+"?")) return;

        var me = this;
        this.core.api.deleteServerCertificate(item.name, function() { me.refresh(); });
    },
};

var ew_VMFATreeView = {
    model: ["vmfas", "users"],

    menuChanged: function()
    {
        var item = this.getSelected();
        $('ew.vmfas.contextmenu.delete').disabled = item == null;
        $('ew.vmfas.contextmenu.assign').disabled = !item || item.userName;
        $('ew.vmfas.contextmenu.unassign').disabled = !item || !item.userName;
    },

    addDevice: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        var values = this.core.promptInput('Create Virtual MFA device', [{label:"Device Name",required:1}, {label:"Device Path"}]);
        if (!values) return;
        this.core.api.createVirtualMFADevice(values[0], values[1], function(obj) {
            me.refresh()
            var png = "data:image/png;base64," + obj.qrcode;
            me.core.promptInput('New Virtual MFA device', [{label:"Serial",value:obj.id,type:'label'}, {label:"QRCode",value:png,type:'image',fixed:true,minheight:300,maxheight:300,minwidth:300,maxwidth:300,height:300,width:300}, {label:"Secret Key",value:obj.seed,type:'label'}]);
        });
    },

    deleteDevice: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item) return;
        if (!confirm('Delete Virtual MFA device ' + item.id)) return;
        this.core.api.deleteVirtualMFADevice(item.id, function(){ me.refresh() });
    },

    assignDevice: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || item.userName) return;
        var users = this.core.queryModel('users');
        var idx = this.core.promptList("User name", "Select user to assign this device to", users);
        if (idx < 0) return;
        var values = this.core.promptInput('Assign MFA device', [{label:"Auth Code 1",required:1}, {label:"Auth Code 2",required:1}]);
        if (!values) return;
        this.core.api.enableMFADevice(users[idx].name, item.id, values[0], values[1], function() { me.refresh() });
    },

    unassignDevice: function()
    {
        var me = this;
        var item = this.getSelected();
        if (!item || !item.userName) return;
        if (!confirm('Deactivate MFA device from user ' + item.userName)) return;
        this.core.api.deactivateMFADevice(item.userName, item.id, function() { me.refresh() });
    },
};

var ew_PasswordPolicyView = {
    obj: null,
    rowCount: 0,

    activate: function() {
        this.refresh();
    },

    refresh: function() {
        var me = this;
        this.core.api.getAccountPasswordPolicy(function(obj) {
            me.obj = obj;
            for (var p in obj) {
                var e = $('ew.' + p);
                if (!e) continue;
                if (e.tagName == 'textbox') e.value = obj[p]; else e.checked = obj[p] == "true";
            }
            $("ew.DisableAccountPasswordPolicy").hidden = obj.disabled;
            $("ew.SaveAccountPasswordPolicy").setAttribute('label', obj.disabled ? "Enable and Save" : "Save");
        });
    },

    deactivate: function() {
    },

    display: function() {
    },

    invalidate: function() {
    },

    disable: function()
    {
        var me = this;
        if (!confirm('Disable account password policy?')) return;
        this.core.api.deleteAccountPasswordPolicy(function() { me.refresh() });
    },

    save: function() {
        for (var p in this.obj) {
            var e = $('ew.' + p)
            if (!e) continue;
            this.obj[p] = e.tagName == 'textbox' ? e.value : e.checked;
        }
        this.core.api.updateAccountPasswordPolicy(this.obj, function() { alert('Password policy has been updated') });
    },
};

var ew_AccountSummaryView = {
    rowCount: 0,

    activate: function() {
        this.refresh();
    },

    refresh: function() {
        var me = this;
        var e = $('ew.iam.accountId').value = this.core.user.accountId || "";
        this.core.api.listAccountAliases(function(alias) {
            $('ew.iam.alias').value = alias || "Not set";
            $('ew.iam.alias.create').label = alias == "" ? "Create Alias" : "Change Alias";
            $('ew.iam.alias.create').hidden = false;
            $('ew.iam.alias.delete').hidden = alias == "";
            $('ew.iam.console').value = alias != "" ? "https://" + alias + ".signin.aws.amazon.com/console" : "Not Set";
            $('ew.iam.console').setAttribute("style", alias != "" ? "color:blue" : "color:black");
        });
        this.core.api.getAccountSummary(function(list) {
            for (var i in list) {
                var e = $('ew.iam.' + list[i].key);
                if (!e) continue;
                switch (list[i].key) {
                case "AccountMFAEnabled":
                    list[i].value = list[i].value == "1" ? "Yes" : "No";
                    break;
                }
                e.value = list[i].value;
            }
        });
    },

    deactivate: function() {
    },

    display: function() {
    },

    invalidate: function() {
    },

    showConsole: function()
    {
        var url = $('ew.iam.console').value;
        if (url.indexOf("https://") == 0) this.core.displayUrl(url);
    },

    createAlias: function()
    {
        var name = prompt('Account alias:');
        if (!name) return;
        this.core.api.createAccountAlias(name, function() { me.refresh() });
    },

    deleteAlias: function()
    {
        var me = this;
        if (!confirm('Delete account alias?')) return;
        this.core.api.deleteAccountAlias(('ew.iam.alias').value, function() { me.refresh() });
    },

};
