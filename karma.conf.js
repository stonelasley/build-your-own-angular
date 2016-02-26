var istanbul = require('browserify-istanbul');
module.exports = function(config) {
  config.set({
    frameworks: ['browserify', 'jasmine'],
    files: [
      {pattern: 'src/**/*.js', watched: false, included: true, served: true},
      'test/**/*_spec.js'
    ],
    preprocessors: {
      'test/**/*.js': ['jshint', 'browserify'],
      'src/**/*.js': ['jshint', 'browserify', 'coverage']
    },
    browsers: ['PhantomJS'],
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