var istanbul = require('browserify-istanbul');
module.exports = function(config) {
  config.set({
    frameworks: ['browserify', 'jasmine'],
    files: [
      'src/**/*.js',
      'test/**/*_spec.js'
    ],
    preprocessors: {
      'test/**/*.js': ['jshint', 'browserify'],
      'src/**/*.js': ['jshint', 'browserify', 'coverage']
    },
    browsers: ['PhantomJS'],
    browserify: {
      debug: true
    },
    reporters: ['progress', 'coverage', 'coveralls'],
    browserify: {
      debug: true,
      transform: [istanbul({
        ignore: ['**/node_modules/**', '**/test/**'],
      })],
    },
    coverageReporter: {
      dir: 'coverage/',
      reporters: [
        {type: 'lcov', subdir: 'report-lcov'},
        {type: 'text-summary'}
      ]
    }
  })
}