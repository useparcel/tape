# @useparcel/tape-css-inline

Tape optimizer which inlines CSS in HTML assets.

## Install

```
$ npm install @useparcel/tape-css-inline
```

## Configuration

It accepts the same configuration as [juice](https://github.com/Automattic/juice#options) with one additional option: `juiceResources`. If `juiceResources` it set to `true` then remote resources will be inlined, otherwise it ignore them.
