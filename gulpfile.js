
const autoprefixer = require('gulp-autoprefixer')
const browserSync = require('browser-sync').create()
const cleanCSS = require('gulp-clean-css')
const composer = require('gulp-uglify/composer')
const concat = require('gulp-concat')
const data = require('gulp-data')
const del = require('del')
const fs = require('fs')
const favicons = require("favicons").stream
const gulp = require('gulp')
const gzip = require('gulp-gzip')
const htmlmin = require('gulp-htmlmin')
const imagemin = require('gulp-imagemin')
const jsoncombine = require("gulp-jsoncombine")
const log = require('fancy-log')
const markdownToJSON = require('gulp-markdown-to-json')
const marked = require('marked')
const nunjucksRender = require('gulp-nunjucks-render')
const optimizejs = require('gulp-optimize-js')
const plumber = require('gulp-plumber')
const prettyHtml = require('gulp-pretty-html')
const rename = require('gulp-rename')
const responsive = require('gulp-responsive')
const rev = require('gulp-rev')
const sass = require('gulp-sass')
const sourcemaps = require('gulp-sourcemaps')
const uglify = require('uglify-es')

const minify = composer(uglify, console)

/** Javascript **/

gulp.task('javascript-concat', () => {
	return gulp.src('./src/scripts/*.js')
		.pipe(plumber())
		.pipe(concat({path: 'bundled.js', cwd: ''}))
		.pipe(minify())
    .pipe(optimizejs())
		.pipe(rename('bundled'))
		.pipe(gulp.dest('./holder'))
})

gulp.task('javascript', gulp.series('javascript-concat', ()=>{
  return gulp.src('./holder/bundled')
		.pipe(plumber())
    .pipe(rev())
		.pipe(rename({extname: ".js"}))
		.pipe(gulp.dest('./build'))
    .pipe(rev.manifest('./src/nunjucks/data.json',{
      base:'./src/nunjucks/',
			merge: true // Merge with the existing manifest if one exists
		}))
		.pipe(gulp.dest('./src/nunjucks/'))
}))


/** Sass and CSS **/

gulp.task('sass', ()=> {
  return gulp.src('./src/styles/main.scss')
	  .pipe(plumber())
		.pipe(sourcemaps.init())
	  .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
		.pipe(rename('main'))
		.pipe(sourcemaps.write())
    .pipe(gulp.dest('./holder'))
})

gulp.task('css', gulp.series('sass', ()=>{
  return gulp.src('./holder/main')
	  .pipe(plumber())
		.pipe(sourcemaps.init())
    .pipe(autoprefixer())
		.pipe(cleanCSS({compatibility: 'ie7'}))
  //  .pipe(rev())
		.pipe(sourcemaps.write())
		.pipe(rename({extname: ".css"}))
    .pipe(gulp.dest('./build/css'))
    .pipe(rev.manifest('./src/nunjucks/data.json',{
      base:'./src/nunjucks/',
			merge: true // Merge with the existing manifest if one exists
		}))
		.pipe(gulp.dest('./src/nunjucks/'))
}))


/** Images **/

gulp.task('images', () => {
	return gulp.src('./src/assets/*')
		.pipe(plumber())
		.pipe(imagemin())
		.pipe(gulp.dest('./build/assets'))
})

gulp.task('favicon', () => {
	return gulp.src('./src/assets/logo.png')
		.pipe(plumber())
    .pipe(favicons({
        version: 1.0,
        logging: false,
        html: "index.html",
        pipeHTML: true,
        replace: true,
        url: 'http://octopusoddments.com',
        icons: {
          android: false,              // Create Android homescreen icon. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
          appleIcon: false,            // Create Apple touch icons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
          appleStartup: false,         // Create Apple startup images. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
          coast: false,                // Create Opera Coast icon. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
          favicons: true,             // Create regular favicons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
          firefox: false,              // Create Firefox OS icons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
          windows: false,              // Create Windows 8 tile icons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
          yandex: false
        }
    }))
		.pipe(gulp.dest('./build/'))
})


/** Markdown Posts to Nunjucks **/

marked.setOptions({
  pedantic: true,
  smartypants: true
})

// Create JSON files from any markdown files
gulp.task('markdown_json', () => {
   return gulp.src('./src/markdown/*.md')
 		.pipe(plumber())
    .pipe(markdownToJSON(marked))
    .pipe(gulp.dest('./holder/'))
})

// Combine markdown JSON to form the blog posts JSON data file
gulp.task('json_concat', () => {
   return gulp.src('./holder/*.json')
 		.pipe(plumber())
    .pipe(jsoncombine("bundled.json",function(data, meta){
      return Buffer.from(JSON.stringify(data))
    }))
    .pipe(gulp.dest('./holder/'))
})

// Pass the data files to the nunjuck templates to render as HTML
gulp.task('json_nunjucks', (done) => {
  const postsData = JSON.parse(fs.readFileSync('./holder/bundled.json'))
  const jucksData = JSON.parse(fs.readFileSync('./src/nunjucks/data.json'))

  let tags = {}
  // Pass navigation info to the posts and tags archives
  if (jucksData.navigation) {
    postsData.navigation = jucksData.navigation
    tags.navigation = jucksData.navigation
  } else {
    postsData.navigation = ['index']
    tags.navigation = ['index']
  }

  // Create Posts
  if (postsData) {
    for ( let post in postsData) {
      // Skip Navigation
      if (post === 'navigation') {
        continue
      }
      // Create data for Tag Archives
      for ( let index in postsData[post].tags) {
        const tag = postsData[post].tags[index]
        /* example:
        tags: {
          illustration: {
            title: 'illustration',
            slug: 'illustration',
            posts: [
              {...},
              {...} etc.
            ]
          }
        } */
        if (tags.hasOwnProperty(tag)) {
          tags[tag].posts.push(postsData[post])
        } else {
          tags[tag] = {
            title: tag,
            slug: tag.replace(/[\W]/g, '_').toLowerCase(),
            posts: [postsData[post]]
          }
        }
      }
      postsData[post].navigation = postsData.navigation
      // Send data to posts template
      gulp.src('./src/nunjucks/post.nunjucks')
      .pipe(plumber())
      .pipe(nunjucksRender({
        path: ['./src/nunjucks/'],
        data: postsData[post]
      }))
      .pipe(htmlmin(
        {
          collapseWhitespace: false,
          removeComments: true
        }))
      .pipe(rename('index.html'))
      .pipe(gulp.dest('./build/posts/'+postsData[post].slug))
    }

    // Send data to archive template
    for (let index in tags) {
      if (index === 'navigation') {
        continue
      }
      tags[index].navigation = tags.navigation
      gulp.src('./src/nunjucks/archive.nunjucks')
      .pipe(plumber())
      .pipe(data(tags[index]))
      .pipe(nunjucksRender({
        path: ['./src/nunjucks/']
      }))
      .pipe(htmlmin({
        collapseWhitespace: false,
        removeComments: true
      }))
      .pipe(rename(tags[index].slug+'.html'))
      .pipe(gulp.dest('./build'))
    }
  // Send an error if Blog task was called without a blog data file
  } else {
    log.error('Posts data file could not be found')
  }


	gulp.src(['./holder/bundled.json', './src/nunjucks/data.json'])
	 .pipe(plumber())
	 .pipe(jsoncombine("data.json",function(data, meta){
		 let test = data
		 let newTest = {...test.data}
		 newTest.posts = []
		 for ( let post in test.bundled) {
			 newTest.posts.push(test.bundled[post])
		 }
		 testData = {...newTest}
		 return Buffer.from(JSON.stringify(newTest))
	 }))
	 .pipe(gulp.dest('./holder'))
  done()
})

gulp.task('postsData', ()=> {
  return 	gulp.src(['./holder/bundled.json', './src/nunjucks/data.json'])
		 .pipe(plumber())
		 .pipe(jsoncombine("data.json",function(data, meta){
			 let test = data
			 let newTest = {...test.data}
			 newTest.posts = []
			 for ( let post in test.bundled) {
				 newTest.posts.push(test.bundled[post])
			 }
			 testData = {...newTest}
			 return Buffer.from(JSON.stringify(newTest))
		 }))
		 .pipe(gulp.dest('./holder'))
})


/** Nunjucks to HTML **/

gulp.task('html', ()=> {
  return gulp.src('./src/*.nunjucks')
		.pipe(plumber())
    .pipe(data(() => {
			return JSON.parse(fs.readFileSync('./holder/data.json'))
		}))
    .pipe(nunjucksRender({
      path: ['./src/nunjucks/']
    }))
    .pipe(htmlmin(
      {
        collapseWhitespace: false,
        removeComments: true
      }))
    .pipe(gulp.dest('./build'))
})


gulp.task('markdown', gulp.series(
  'markdown_json',
  'json_concat',
  'json_nunjucks',
  'postsData',
  'html'
))
/** GZIP **/

gulp.task('gzip', () => {
	return gulp.src([
    './build/*.js',
    './build/*.html',
    './build/css/*.css'
  ])
		.pipe(plumber())
    .pipe(gzip())
		.pipe(gulp.dest('./build'))
})

/** Compile files and delete holder folders **/

gulp.task('compile', gulp.series(
  ()=>{ return del('./build') },
  'javascript',
  'css',
  'images',
  'favicon',
  'markdown',
//  'gzip',
  ()=>{ return del('./holder') }
))


/** Server **/

gulp.task('serve', function(done) {
  browserSync.init({
    server: {
      baseDir: './build'
    }
  })
  gulp.watch(['./src/**/*.scss', './src/**/*.md', './src/scripts/*.js', './src/**/*.nunjucks'], gulp.series(
		'compile',
		'reload'
	))
  done();
})

gulp.task('reload', (done)=> {
  browserSync.reload()
  done();
})


gulp.task('build', gulp.series('compile', 'serve'))
