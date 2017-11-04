'use strict';

var inherits = require('util').inherits;
var Service, Characteristic, AwayCharacteristic, FanSpeedCharacteristic;
var mqtt = require("mqtt");


function mqtthomegearthermostatAccessory(log, config) {
    this.log = log;
    this.name = config["name"];
    this.url = config["url"];
    this.client_Id = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    this.options = {
        keepalive: 10,
        clientId: this.client_Id,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        will: {
            topic: 'WillMsg',
            payload: 'Connection Closed abnormally..!',
            qos: 0,
            retain: false
        },
        username: config["username"],
        password: config["password"],
        rejectUnauthorized: false
    };

    this.caption = config["caption"];
    this.topics = config["topics"];
    this.TargetTemperature = 27;
    this.CurrentTemperature = 0;
    this.TargetHeatingCoolingState = 0;
    this.CurrentHeatingCoolingState = 0;
    this.TemperatureDisplayUnits = 0;
    this.FanSpeed = 0;
    //  this.Away                       = 0;


    this.options_publish = {
        qos: 0,
        retain: true
    };

    this.service = new Service.Thermostat(this.name);
    //  this.service.addCharacteristic(AwayCharacteristic);
    //  this.service.getCharacteristic(AwayCharacteristic)
    //    .on('get', this.isAway.bind(this))
    //    .on('set', this.setAway.bind(this));

    //   this.service.addCharacteristic(FanSpeedCharacteristic);
    //   this.service.getCharacteristic(FanSpeedCharacteristic)
    //     .on('get', this.getFanSpeed.bind(this))
    //     .on('set', this.setFanSpeed.bind(this));

    this.service.getCharacteristic(Characteristic.TargetTemperature)
        .setProps({
            maxValue: 30,
            minValue: 10,
            minStep: 0.5
        })
        .on('set', this.setTargetTemperature.bind(this))
        .on('get', this.getTargetTemperature.bind(this));

    //   this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
    //     .on('set', this.setTargetHeatingCoolingState.bind(this))
    //     .on('get', this.getTargetHeatingCoolingState.bind(this));

    this.service.getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
            maxValue: 50,
            minValue: 0,
            minStep: 0.01
        })
        .on('get', this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.getTemperatureDisplayUnits.bind(this));

    //   this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)    
    //     .on('get', this.getCurrentHeatingCoolingState.bind(this));

    // connect to MQTT broker
    this.client = mqtt.connect(this.url, this.options);
    var that = this;
    this.client.on('error', function(err) {
        that.log('Error event on MQTT:', err);
    });



    this.client.on('message', function(topic, message) {
        switch (topic) {
            case `${that.topics.get}4/SET_TEMPERATURE`:
                that.TargetTemperature = message;
                that.service.getCharacteristic(Characteristic.TargetTemperature).setValue(that.TargetTemperature, undefined, 'fromSetValue');
                break;
            case `${that.topics.get}4/ACTUAL_TEMPERATURE`:
                that.CurrentTemperature = message;
                that.service.getCharacteristic(Characteristic.CurrentTemperature).setValue(that.CurrentTemperature, undefined, 'fromSetValue');
                break;
        }


        // TODO 

        // that.CurrentFanSpeed = 0;
        // that.service.getCharacteristic(FanSpeedCharacteristic).setValue(that.CurrentFanSpeed, undefined, 'fromSetValue');

        // that.TargetHeatingCoolingState = 0;
        // that.service.getCharacteristic(Characteristic.TargetHeatingCoolingState).setValue(that.TargetHeatingCoolingState, undefined, 'fromSetValue');

        // that.CurrentHeatingCoolingState = 0;
        // that.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setValue(that.CurrentHeatingCoolingState, undefined, 'fromSetValue');        

    });

    this.client.subscribe(this.topics.get + '/#');
}

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    //   makeAwayCharacteristic();
    //   makeFanSpeedCharacteristic();
    homebridge.registerAccessory("homebridge-mqtt-homegear-thermostat", "mqtt-homegear-thermostat", mqtthomegearthermostatAccessory);
}

// mqtthomegearthermostatAccessory.prototype.setAway = function(Away, callback, context) {
//    if(context !== 'fromSetValue') {
//      this.Away = Away;
//      this.client.publish(this.topics.set + 'setAway', String(this.Away), this.options_publish); 
//    }
//    callback();
// }      

// mqtthomegearthermostatAccessory.prototype.setFanSpeed = function(Fanspeed, callback, context) {
//     if(context !== 'fromSetValue') {
//       this.Fanspeed = Fanspeed;
//       this.client.publish(this.topics.set + 'setFanSpeed', String(this.Fanspeed), this.options_publish); 
//     }
//     callback();
// }

// mqtthomegearthermostatAccessory.prototype.setTargetHeatingCoolingState = function(TargetHeatingCoolingState, callback, context) {
//     if(context !== 'fromSetValue') {
//       this.TargetHeatingCoolingState = TargetHeatingCoolingState;
//       this.client.publish(this.topics.set + 'setTargetHeatingCoolingState', String(this.TargetHeatingCoolingState), this.options_publish); 
//     }
//     callback();
// }

mqtthomegearthermostatAccessory.prototype.setTargetTemperature = function(TargetTemperature, callback, context) {
    if (context !== 'fromSetValue') {
        this.TargetTemperature = TargetTemperature;
        this.client.publish(`${this.topics.set}4/SET_TEMPERATURE`, String(this.TargetTemperature), this.options_publish);
    }
    callback();
}

// mqtthomegearthermostatAccessory.prototype.isAway = function(callback) {
//    callback(null, this.Away);
// }        

// mqtthomegearthermostatAccessory.prototype.getFanSpeed = function(callback) {
//     callback(null, this.Fanspeed);
// }

// mqtthomegearthermostatAccessory.prototype.getTargetHeatingCoolingState = function(callback) {
//     callback(null, this.TargetHeatingCoolingState);
// }

mqtthomegearthermostatAccessory.prototype.getTargetTemperature = function(callback) {
    callback(null, this.TargetTemperature);
}

mqtthomegearthermostatAccessory.prototype.getCurrentTemperature = function(callback) {
    callback(null, this.CurrentTemperature);
}

mqtthomegearthermostatAccessory.prototype.getTemperatureDisplayUnits = function(callback) {
    callback(null, this.TemperatureDisplayUnits);
}

// mqtthomegearthermostatAccessory.prototype.getCurrentHeatingCoolingState = function(callback) {
//     callback(null, this.CurrentHeatingCoolingState);
// }

mqtthomegearthermostatAccessory.prototype.getServices = function() {
    return [this.service];
}


// function makeAwayCharacteristic() {

//     AwayCharacteristic = function() {
//         Characteristic.call(this, 'Away', '91288267-5678-49B2-8D22-F57BE995AA00');
//         this.setProps({
//           format: Characteristic.Formats.BOOL,
//           perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
//         });
//         this.value = this.getDefaultValue();
//     };

//     inherits(AwayCharacteristic, Characteristic);
//     AwayCharacteristic.HOME = 0;
//     AwayCharacteristic.AWAY = 1;
// }

// function makeFanSpeedCharacteristic() {

//     FanSpeedCharacteristic = function() {
//         Characteristic.call(this, 'FanSpeed', '00011033-0000-0000-8000-0026BB765291');
//         this.setProps({
//           format: Characteristic.Formats.UINT8, 
//           maxValue: 2,
//           minValue: 0,
//           minStep: 1,
//           perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
//         });
//         this.value = this.getDefaultValue();
//     };

//     inherits(FanSpeedCharacteristic, Characteristic);
//     FanSpeedCharacteristic.LOW  = 0;
//     FanSpeedCharacteristic.MID  = 1;
//     FanSpeedCharacteristic.HIGH = 2;
// }