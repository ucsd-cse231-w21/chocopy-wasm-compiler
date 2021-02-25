'use strict';
const minify = require('gulp-minify');
const terser = require('gulp-terser');
const {
  watch,
  series
} = require('gulp');
var browserSync = require('browser-sync').create(),
  gulp = require('gulp'),
  less = require('gulp-less'),
  livereload = require('gulp-livereload'),
  sass = require('gulp-sass'),
  sassRuby = require('gulp-ruby-sass'),
  notify = require("gulp-notify"),
  bower = require('gulp-bower'),
  sourcemaps = require('gulp-sourcemaps'),
  autoprefixer = require('gulp-autoprefixer'),
  plumber = require('gulp-plumber'),
  uglify = require('gulp-uglify'),
  istanbul = require('gulp-istanbul'),
  eslint = require('gulp-eslint');

var devEnv = 'dpboost.lndo.site';

function errorAlert(error) {
  notify.onError({
    title: "SCSS Error",
    message: "😭 Check your terminal to see what's wrong in your sass files 😭"
  })(error);
  console.log(error.toString());
  this.emit("end");
};

gulp.task('sass', function () {
    var stream = gulp.src('./sass/*.scss')
      .pipe(plumber({
        errorHandler: errorAlert
      }))
      .pipe(sourcemaps.init())
      .pipe(sass({
        errLogToConsole: true,
        outputStyle: 'compressed'
      }))
      .pipe(autoprefixer('last 2 version'))
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('./css'))
      .pipe(browserSync.stream())
      .pipe(notify({
        message: '🍺 gulp is Done! 🍺',
        onLast: true
      }));
    return stream;
  });


  exports.default = function () {
    watch('./sass/{,*/}*.scss', series('sass')).on('change', browserSync.reload)
    watch('./sass/*.scss', series('sass')).on('change', browserSync.reload)
  };
