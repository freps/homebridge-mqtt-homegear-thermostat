'use strict';

var inherits = require('util').inherits;
var Service, Characteristic, BatteryCharacteristic, FanSpeedCharacteristic;
var mqtt = require("mqtt");

// enum https://developer.apple.com/documentation/homekit/hmcharacteristicvalueheatingcooling
var heatingCoolingStates = {
    OFF: 0,
    HEAT: 1,
    COOL: 2,
    AUTO: 3
};


var hmDeviceStates = {
    MANU: 1,
    AUTO: 0
};


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
    this.controlModeState = 0;
    this.FanSpeed = 0;
    this.Battery = 0;


    this.options_publish = {
        qos: 0,
        retain: true
    };

    this.service = new Service.Thermostat(this.name);
    this.service.addCharacteristic(BatteryCharacteristic);
    this.service.getCharacteristic(BatteryCharacteristic)
        .on('get', this.getBattery.bind(this));

    this.service.addCharacteristic(FanSpeedCharacteristic);
    this.service.getCharacteristic(FanSpeedCharacteristic)
        .on('get', this.getFanSpeed.bind(this));

    this.service.getCharacteristic(Characteristic.TargetTemperature)
        .setProps({
            maxValue: 30,
            minValue: 10,
            minStep: 0.5
        })
        .on('set', this.setTargetTemperature.bind(this))
        .on('get', this.getTargetTemperature.bind(this));

    this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('set', this.setTargetHeatingCoolingState.bind(this))
        .on('get', this.getTargetHeatingCoolingState.bind(this));

    this.service.getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
            maxValue: 50,
            minValue: 0,
            minStep: 0.01
        })
        .on('get', this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.getTemperatureDisplayUnits.bind(this));

    this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .on('get', this.getCurrentHeatingCoolingState.bind(this));

    // connect to MQTT broker
    this.client = mqtt.connect(this.url, this.options);

    this.client.on('error', (err) => {
        this.log('Error event on MQTT:', err);
    });

    this.client.on('message', (topic, message) => {
        switch (topic) {
            case `${this.topics.get}4/SET_TEMPERATURE`:
                // change SET_TEMPERATURE
                this.TargetTemperature = parseFloat(message.toString());
                this.service.getCharacteristic(Characteristic.TargetTemperature).setValue(this.TargetTemperature, undefined, 'fromSetValue');

                // if temperature is low, devices shows "OFF" on the display. This should be same as "OFF" in the app
                var changeState = -1;
                if (this.TargetTemperature < 5 && this.TargetHeatingCoolingState != heatingCoolingStates.OFF) {
                    changeState = heatingCoolingStates.OFF;
                    this.log(`MQTT MSG SET_TEMPERATURE: Temperature low. Change state to OFF`);
                }

                // if device is higher than "OFF" but state in HomeKit is "OFF", change it to previous value 
                if (this.TargetTemperature >= 5 && this.TargetHeatingCoolingState == heatingCoolingStates.OFF) {
                    if (this.controlModeState === hmDeviceStates.MANU) {
                        changeState = heatingCoolingStates.HEAT;
                        this.log(`MQTT MSG SET_TEMPERATURE: Temperature high. Change state to HEAT`);
                    } else {
                        changeState = heatingCoolingStates.AUTO;
                        this.log(`MQTT MSG SET_TEMPERATURE: Temperature high. Change state to AUTO`);
                    }
                }

                // perform change, if there is one
                if (changeState > -1) {
                    this.TargetHeatingCoolingState = changeState;
                    this.CurrentHeatingCoolingState = changeState;
                    this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState).setValue(this.TargetHeatingCoolingState, undefined, 'fromSetValue');
                    this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setValue(this.CurrentHeatingCoolingState, undefined, 'fromSetValue');
                }
                break;

            case `${this.topics.get}4/ACTUAL_TEMPERATURE`:
                this.CurrentTemperature = parseFloat(message.toString());
                this.service.getCharacteristic(Characteristic.CurrentTemperature).setValue(this.CurrentTemperature, undefined, 'fromSetValue');
                break;

            case `${this.topics.get}4/CONTROL_MODE`:
                this.controlModeState = parseInt(message.toString());

                var res;
                if (this.TargetTemperature < 5) {
                    this.log(`MQTT MSG CONTROL_MODE: temperature is LOW - homekit state OFF`);
                    res = heatingCoolingStates.OFF;
                } else if (this.controlModeState === hmDeviceStates.MANU) {
                    res = heatingCoolingStates.HEAT;
                    this.log(`MQTT MSG CONTROL_MODE: given MANU - change homekit to HEAT`);

                } else { // HM: AUTO_MODE 
                    res = heatingCoolingStates.AUTO;
                    this.log(`MQTT MSG CONTROL_MODE: given AUTO - change homekit to AUTO`);
                }

                this.TargetHeatingCoolingState = res;
                this.CurrentHeatingCoolingState = res;
                this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState).setValue(this.TargetHeatingCoolingState, undefined, 'fromSetValue');
                this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setValue(this.CurrentHeatingCoolingState, undefined, 'fromSetValue');
                break;


            case `${this.topics.get}4/VALVE_STATE`:
                this.CurrentFanSpeed = parseInt(message.toString());
                this.service.getCharacteristic(FanSpeedCharacteristic).setValue(this.CurrentFanSpeed, undefined, 'fromSetValue');
                break;
            case `${this.topics.get}4/BATTERY_STATE`:
                this.Battery = parseFloat(message.toString());
                this.service.getCharacteristic(BatteryCharacteristic).setValue(this.Battery, undefined, 'fromSetValue');
                break;
        }
    });

    this.client.subscribe(this.topics.get + '#');
}

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    makeBatteryCharacteristic();
    makeFanSpeedCharacteristic();
    homebridge.registerAccessory("homebridge-mqtt-homegear-thermostat", "mqtt-homegear-thermostat", mqtthomegearthermostatAccessory);
}



mqtthomegearthermostatAccessory.prototype.setTargetHeatingCoolingState = function(TargetHeatingCoolingState, callback, context) {
    if (context !== 'fromSetValue') {
        this.TargetHeatingCoolingState = TargetHeatingCoolingState;

        if (this.TargetHeatingCoolingState == heatingCoolingStates.HEAT) {
            this.TargetTemperature = this.TargetTemperature < 10 ? 16 : this.TargetTemperature;
            this.client.publish(`${this.topics.set}4/MANU_MODE`, String(this.TargetTemperature), this.options_publish);
            this.log(`setTargetHeatingCoolingState: Changed mode to MANU`);
        } else if (this.TargetHeatingCoolingState == heatingCoolingStates.OFF || this.TargetHeatingCoolingState == heatingCoolingStates.COOL) {
            this.TargetTemperature = 4.5;
            this.client.publish(`${this.topics.set}4/MANU_MODE`, String(this.TargetTemperature), this.options_publish);
            this.log(`setTargetHeatingCoolingState: Changed mode to OFF`);
        } else { // auto
            this.client.publish(`${this.topics.set}4/AUTO_MODE`, "true", this.options_publish);
            this.log(`setTargetHeatingCoolingState: Changed mode to AUTO`);
        }
    }
    callback();
}

mqtthomegearthermostatAccessory.prototype.setTargetTemperature = function(TargetTemperature, callback, context) {
    if (context !== 'fromSetValue') {
        this.TargetTemperature = TargetTemperature;
        this.client.publish(`${this.topics.set}4/SET_TEMPERATURE`, String(this.TargetTemperature), this.options_publish);
    }
    callback();
}

mqtthomegearthermostatAccessory.prototype.getBattery = function(callback) {
    callback(null, this.Battery);
}

mqtthomegearthermostatAccessory.prototype.getFanSpeed = function(callback) {
    callback(null, this.Fanspeed);
}

mqtthomegearthermostatAccessory.prototype.getTargetHeatingCoolingState = function(callback) {
    callback(null, this.TargetHeatingCoolingState);
}

mqtthomegearthermostatAccessory.prototype.getTargetTemperature = function(callback) {
    callback(null, this.TargetTemperature);
}

mqtthomegearthermostatAccessory.prototype.getCurrentTemperature = function(callback) {
    callback(null, this.CurrentTemperature);
}

mqtthomegearthermostatAccessory.prototype.getTemperatureDisplayUnits = function(callback) {
    callback(null, this.TemperatureDisplayUnits);
}

mqtthomegearthermostatAccessory.prototype.getCurrentHeatingCoolingState = function(callback) {
    callback(null, this.CurrentHeatingCoolingState);
}

mqtthomegearthermostatAccessory.prototype.getServices = function() {
    return [this.service];
}


function makeBatteryCharacteristic() {
    BatteryCharacteristic = function() {
        Characteristic.call(this, 'Battery', '91288267-5678-49B2-8D22-F57BE995AA00');
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: 'V',
            maxValue: 4,
            minValue: 0,
            minStep: 0.01,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(BatteryCharacteristic, Characteristic);
}

function makeFanSpeedCharacteristic() {

    FanSpeedCharacteristic = function() {
        Characteristic.call(this, 'Valve State', '00011033-0000-0000-8000-0026BB765291');
        this.setProps({
            format: Characteristic.Formats.UINT8,
            unit: '%',
            maxValue: 100,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(FanSpeedCharacteristic, Characteristic);
}