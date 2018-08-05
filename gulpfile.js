var gulp = require('gulp'),
    pump = require('pump'),
    clean = require('gulp-clean'),
    babel = require('gulp-babel'),
    uglify = require('gulp-uglify'),
    postcss = require('gulp-postcss'),
    cssnext = require('postcss-cssnext'),
    csso = require('postcss-csso');

// - VARS

var conf = {
    src:   './src/',
    build: './dist/'
};

var files = {
    js: '*.js',
    css: '*.css',
    html: '*.html',
    data: '*',
    img: '*',
    misc: '/manifest.json'
};

var folders = {
    src: {
        js: {
            files: conf.src + 'js/',
            libs:  conf.src + 'js/lib/'
        },
        css: {
            files: conf.src + 'css/',
            libs:  conf.src + 'css/lib/'
        },
        html: {
            libs:  conf.src
        },
        data: {
            libs:  conf.src + 'data/'
        },
        img: {
            libs:  conf.src + 'img/'
        },
        misc: {
            libs:  conf.src
        }
    },
    build: {
        js: {
            files: conf.build + 'js/',
            libs: conf.build + 'js/lib/'
        },
        css: {
            files: conf.build + 'css/',
            libs: conf.build + 'css/lib/'
        },
        html: {
            libs: conf.build
        },
        data: {
            libs: conf.build + 'data/'
        },
        img: {
            libs: conf.build + 'img/'
        },
        misc: {
            libs: conf.build
        }
    }
};

var paths = {
    src: {
        js: {
            files: folders.src.js.files + files.js,
            libs:  folders.src.js.libs + files.js
        },
        css: {
            files: folders.src.css.files + files.css,
            libs:  folders.src.css.libs + files.css
        },
        html: {
            libs:  folders.src.html.libs + files.html
        },
        data: {
            libs:  folders.src.data.libs + files.data
        },
        img: {
            libs:  folders.src.img.libs + files.img
        },
        misc: {
            libs:  folders.src.misc.libs + files.misc
        }
    },
    build: {
        js: {
            files:  folders.build.js.files + files.js,
            libs_files: folders.build.js.libs + files.js
        },
        css: {
            files:  folders.build.css.files + files.css,
            libs_files: folders.build.css.libs + files.css
        },
        html: {
            libs_files:  folders.build.html.libs + files.html
        },
        data: {
            libs_files:  folders.build.data.libs + files.data
        },
        img: {
            libs_files:  folders.build.img.libs + files.img
        },
        misc: {
            libs_files:  folders.build.misc.libs + files.misc
        }
    }
};

// - CLEAN BUILD

function _clean(typ, loc, cb) {
    var files = paths.build[typ][loc];

    pump([
        gulp.src(files, { read: false }),
        clean()
    ], cb);
}

gulp.task('clean_js', function(cb) {
    return _clean('js', 'files', cb);
});

gulp.task('clean_js_libs', function(cb) {
    return _clean('js', 'libs_files', cb);
});

gulp.task('clean_css', function(cb) {
    return _clean('css', 'files', cb);
});

gulp.task('clean_css_libs', function(cb) {
    return _clean('css', 'libs_files', cb);
});

gulp.task('clean_html', function(cb) {
    return _clean('html', 'libs_files', cb);
});

gulp.task('clean_data', function(cb) {
    return _clean('data', 'libs_files', cb);
});

gulp.task('clean_img', function(cb) {
    return _clean('img', 'libs_files', cb);
});

gulp.task('clean_misc', function(cb) {
    return _clean('misc', 'libs_files', cb);
});

gulp.task('clean', ['clean_js', 'clean_js_libs', 'clean_css', 'clean_css_libs', 'clean_html', 'clean_data', 'clean_img', 'clean_misc']);

// - COPY STATIC

function _copy(typ, cb) {
    var from = paths.src[typ].libs;
    var to = folders.build[typ].libs;

    pump([
        gulp.src(from),
        gulp.dest(to)
    ], cb);
}

gulp.task('copy_js', ['clean_js_libs'], function(cb) {
    return _copy('js', cb);
});

gulp.task('copy_css', ['clean_css_libs'], function(cb) {
    return _copy('css', cb);
});

gulp.task('copy_html', ['clean_html'], function(cb) {
    return _copy('html', cb);
});

gulp.task('copy_data', ['clean_data'], function(cb) {
    return _copy('data', cb);
});

gulp.task('copy_img', ['clean_img'], function(cb) {
    return _copy('img', cb);
});

gulp.task('copy_misc', ['clean_misc'], function(cb) {
    return _copy('misc', cb);
});

gulp.task('copy', ['copy_js', 'copy_css', 'copy_html', 'copy_data', 'copy_img', 'copy_misc']);

// - COMPILE

gulp.task('js', ['clean_js'], function(cb) {
    pump([
        gulp.src(paths.src.js.files),
        babel({
            presets: ['es2015']
        }),
        uglify({
            compress: {
                drop_console: true
            }
        }),
        gulp.dest(folders.build.js.files)
    ], cb);
});

gulp.task('css', ['clean_css'], function(cb) {
    pump([
        gulp.src(paths.src.css.files),
        postcss([
            cssnext(),
            csso()
        ]),
        gulp.dest(folders.build.css.files)
    ], cb);
});

// - INIT

var init = ['copy', 'js', 'css'];

gulp.task('default', init, function() {
    gulp.watch(
        [ files.js ],
        { ignoreInitial: false, cwd: folders.src.js.files },
        [ 'js' ]
    );

    gulp.watch(
        [ files.css ],
        { ignoreInitial: false, cwd: folders.src.css.files },
        [ 'css' ]
    );

    gulp.watch(
        [ files.js ],
        { ignoreInitial: false, cwd: folders.src.js.libs },
        [ 'copy_js' ]
    );

    gulp.watch(
        [ files.css ],
        { ignoreInitial: false, cwd: folders.src.js.libs },
        [ 'copy_css' ]
    );

    gulp.watch(
        [ files.html ],
        { ignoreInitial: false, cwd: folders.src.html.libs },
        [ 'copy_html' ]
    );

    gulp.watch(
        [ files.data ],
        { ignoreInitial: false, cwd: folders.src.data.libs },
        [ 'copy_data' ]
    );

    gulp.watch(
        [ files.img ],
        { ignoreInitial: false, cwd: folders.src.img.libs },
        [ 'copy_img' ]
    );

    gulp.watch(
        [ files.misc ],
        { ignoreInitial: false, cwd: folders.src.misc.libs },
        [ 'copy_misc' ]
    );
});
