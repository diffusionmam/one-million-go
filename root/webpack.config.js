const path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'tenuki.js',
    path: path.resolve(__dirname, 'build'),
    library: 'tenuki',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  mode: 'development',
  devtool: 'source-map'
}; 