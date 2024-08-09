const log4js = require("log4js");
const path = require('path');

var loggerName = "ingestor_core";

log4js.configure( {
	appenders : {
		out : {
			type  : 'stdout',
			layout: {
				type   : 'pattern',
				pattern: '%d %[%p%] %X{custom}:%m',
				tokens : {
					user: function ( logEvent )
					{
						return AuthLibrary.currentUser();
					}
				}
			}
		},
		file: {
			type      : 'file',
			layout    : {
				type   : 'pattern',
				pattern: '%d %[%p%] %X{custom}:%m',
				tokens : {
					user: function ( logEvent )
					{
						return AuthLibrary.currentUser();
					}
				}
			},
			mode      : 0o644,
			maxLogSize: 31457280,
			backups   : 30,
			pattern   : "yyyy-MM-dd.log",
			filename  : path.join( '.', 'log', loggerName + '.log' )
		}
	},
	categories: {
		debug  : { enableCallStack: true, appenders: [ 'out', 'file' ], "level": "debug" },
		default: { enableCallStack: true, appenders: [ 'out', 'file' ], "level": "info" },
		error  : { enableCallStack: true, appenders: [ 'out', 'file' ], "level": "error" },
		warn   : { enableCallStack: true, appenders: [ 'out', 'file' ], "level": "warn" }
	}
} );

const logger = log4js.getLogger( loggerName );

logger.level = "debug";
logger.addContext("custom", '');

exports.label = function (label){
	logger.addContext("custom", label);
}

exports.error = function (a) {
	return logger.error(a)
};

exports.info = function (a) {
	return logger.info(a)
};

exports.debug = function (a) {
	return logger.debug(a)
};

exports.warn = function (a) {
	return logger.warn(a)
};
