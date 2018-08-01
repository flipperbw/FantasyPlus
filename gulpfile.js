var gulp = require('gulp'),
    gutil = require('gulp-util'),
    clean = require('gulp-clean'),
    babel = require('gulp-babel'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    postcss = require('gulp-postcss'),
    cssnext = require('postcss-cssnext'),
    csso = require('postcss-csso');

// - VARS

var conf = {
	src:   './src',
	build: './dist'
};

var paths = {
	src: {
		js: {
			files: conf.src + '/js/*.js',
			libs:  conf.src + '/js/lib/*.js'
		},
		css: {
			files: conf.src + '/css/*.css',
			libs:  conf.src + '/css/lib/*.css'
		},
		html: {
			libs:  conf.src + '/*.html'
		},
		data: {
			libs:  conf.src + '/data/*'
		},
		img: {
			libs:  conf.src + '/img/*'
		},
		misc: {
			libs:  conf.src + '/manifest.json'
		}
	},
	build: {
		js: {
			folder: conf.build + '/js',
			libs_folder: conf.build + '/js/lib',
			files:  conf.build + '/js/*.js'
		},
		css: {
			folder: conf.build + '/css',
			libs_folder: conf.build + '/css/lib',
			files:  conf.build + '/css/*.css'
		},
		html: {
			folder: conf.build,
			libs_folder: conf.build,
			files:  conf.build + '/*.html'
		},
		data: {
			folder: conf.build + '/data',
			libs_folder: conf.build + '/data',
			files:  conf.build + '/data/*'
		},
		img: {
			folder: conf.build + '/img',
			libs_folder: conf.build + '/img',
			files:  conf.build + '/img/*'
		},
		misc: {
			folder: conf.build,
			libs_folder: conf.build,
			files:  conf.build + 'manifest.json'
		}
	}
};

// - CLEAN BUILD

function _clean(typ) {
	var files = paths.build[typ].files;

    return gulp
    	.src(files, { read: false })
		.pipe(clean());
}

gulp.task('clean_html', function() {
	return _clean('html');
});

gulp.task('clean_js', function() {
	return _clean('js');
});

gulp.task('clean_css', function() {
	return _clean('css');
});

gulp.task('clean_data', function() {
	return _clean('data');
});

gulp.task('clean_img', function() {
	return _clean('img');
});

gulp.task('clean_misc', function() {
	return _clean('misc');
});

gulp.task('clean', ['clean_html', 'clean_js', 'clean_css', 'clean_data', 'clean_img', 'clean_misc']);

// - COPY STATIC

function _copy(typ) {
	var from = paths.src[typ].libs;
	var to = paths.build[typ].libs_folder;

    return gulp
    	.src(from)
		.pipe(gulp.dest(to));
}

gulp.task('copy_html', function() {
	return _copy('html');
});

gulp.task('copy_js', function() {
	return _copy('js');
});

gulp.task('copy_css', function() {
	return _copy('css');
});

gulp.task('copy_data', function() {
	return _copy('data');
});

gulp.task('copy_img', function() {
	return _copy('img');
});

gulp.task('copy_misc', function() {
	return _copy('misc');
});

gulp.task('copy', ['copy_html', 'copy_js', 'copy_css', 'copy_data', 'copy_img', 'copy_misc']);

// - COMPILE

gulp.task('js', ['clean_js'], function() {
    return gulp
    	.src(paths.src.js.files)
		.on('error', function (err) {
			gutil.log(gutil.colors.red('[Error]'), err.toString());
		})
		.pipe(babel({
			presets: ['es2015']
        }))
    	.pipe(uglify({
			compress: {
				drop_console: true
			}
		}))
    	.pipe(gulp.dest(paths.build.js.folder));
});

gulp.task('css', ['clean_css'], function() {
    return gulp
    	.src(paths.src.css.files)
		.on('error', function (err) {
			gutil.log(gutil.colors.red('[Error]'), err.toString());
		})
    	.pipe(postcss([
			cssnext(),
			csso()
		]))
        .pipe(gulp.dest(paths.build.css.folder));
});

// - INIT

//var init = ['copy', 'js', 'css'];
var init = ['copy', 'js', 'css'];

gulp.task('default', init, function() {
    gulp.watch(
    	[ paths.src.js.files ],
    	{ ignoreInitial: false },
    	[ 'js' ]
    );
	
	gulp.watch(
		[ paths.src.css.files ],
		{ ignoreInitial: false },
		[ 'css' ]
	);
	
	gulp.watch(
		[ paths.src.html.libs ],
		{ ignoreInitial: false },
		[ 'copy_html' ]
	);
	
	gulp.watch(
		[ paths.src.js.libs ],
		{ ignoreInitial: false },
		[ 'copy_js' ]
	);
	
	gulp.watch(
		[ paths.src.css.libs ],
		{ ignoreInitial: false },
		[ 'copy_css' ]
	);
	
	gulp.watch(
		[ paths.src.data.libs ],
		{ ignoreInitial: false },
		[ 'copy_data' ]
	);
	
	gulp.watch(
		[ paths.src.img.libs ],
		{ ignoreInitial: false },
		[ 'copy_img' ]
	);
	
	gulp.watch(
		[ paths.src.misc.libs ],
		{ ignoreInitial: false },
		[ 'copy_misc' ]
	);
});
