'use strict';

// Modules
const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');

/**
 * Env
 * Get npm lifecycle event to identify the environment
 */
const ENV = process.env.npm_lifecycle_event;
const isTest = ENV === 'test' || ENV === 'test-watch';
const isProd = ENV === 'build';
const extractSass = new ExtractTextPlugin({
    filename: "css/[name].[hash].css",
    disable: !isProd
});
const commonsPlugin = new webpack.optimize.CommonsChunkPlugin({
    name: 'vendor',
    filename: 'vendor.js'
});

module.exports = function makeWebpackConfig() {

    const config = {};

    config.entry = isTest ? void 0 : {
        app: './frontend/app/app.js',
        lib: [
            'jquery',
            'angular'
        ]
    };

    config.output = isTest ? {} : {
            // Absolute output directory
            path: __dirname + '/frontend/dist',

            // Output path from the view of the page
            // Uses webpack-dev-server in development
            publicPath: isProd ? '/' : 'http://localhost:8080/',

            // Filename for entry points
            // Only adds hash in build mode
            filename: isProd ? '[name].[hash].js' : '[name].bundle.js',

            // Filename for non-entry points
            // Only adds hash in build mode
            chunkFilename: isProd ? '[name].[hash].js' : '[name].bundle.js'
        };

    if (isTest) {
        config.devtool = 'inline-source-map';
    }
    else if (isProd) {
        config.devtool = 'source-map';
    }
    else {
        config.devtool = 'eval-source-map';
    }

    // Initialize module
    config.module = {
        rules: [
            {
                test   : /\.js$/,
                loader : 'babel-loader',
                exclude: /node_modules/,
                query  : {
                    cacheDirectory: true, //important for performance
                    plugins       : ["transform-regenerator"]
                }
            },
            {
                test: /\.scss$/,
                loader: extractSass.extract({
                    loader: [{
                        loader: "css-loader",
                        query: {sourceMap: true, minimize: true}
                    }, {
                        loader: "sass-loader",
                        query: {sourceMap: true, minimize: true}
                    }],
                    // use style-loader in development
                    fallback: "style-loader"
                })
            },
            {
                test  : /\.css$/,
                loader: isTest ? 'null-loader' : ExtractTextPlugin.extract({
                        fallbackLoader: 'style-loader',
                        loader        : [
                            {loader: 'css-loader', query: {sourceMap: true, minimize: true}},
                            {loader: 'postcss-loader'}
                        ],
                    })
            },
            {
                test  : /\.html$/,
                loader: 'raw-loader'
            },
            { test: /\.json$/, loader: "json" },
            { test: /\.(png|jpg|jpeg|gif|svg)$/, loader: "url-loader?limit=100000" },
            { test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: "url-loader?limit=10000&name=build/fonts/[name].[ext]" },
            { test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: "url-loader?name=build/fonts/[name].[ext]" }
        ]
    };
    
    config.plugins = [
        new webpack.LoaderOptionsPlugin({
            test: /\.scss$/i,
            options: {
                postcss: {
                    plugins: [autoprefixer]
                },
                sassLoader: {
                    includePaths: [path.resolve(__dirname, 'frontend', 'styles')]
                },
                context: '/',
            }
        }),
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
            'window.jQuery': 'jquery',
            'root.jQuery': 'jquery'
        })
    ];

    // Skip rendering index.html in test mode
    if (!isTest) {
        config.plugins.push(
            new HtmlWebpackPlugin({
                template: './frontend/index.html',
                inject: 'body'
            }),
            new ExtractTextPlugin({filename: 'css/[name].[hash].css', disable: !isProd, allChunks: true}),
            extractSass,
            commonsPlugin
        )
    }

    // Add build specific plugins
    if (isProd) {
        config.plugins.push(
            new CleanWebpackPlugin(['dist', 'build'], {
                root: path.resolve(__dirname, 'frontend'),
                verbose: true,
                dry: false,
                exclude: ['vendor.js']
            }),
            new webpack.NoEmitOnErrorsPlugin(),
            new webpack.optimize.UglifyJsPlugin({
                sourceMap: true,
                compress: {warnings: false}
            })
        )
    }

    config.devServer = {
        contentBase: './frontend',
        stats: 'minimal'
    };
    
    config.node = {
        fs: 'empty'
    };

    return config;
}();

