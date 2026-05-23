---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Docs VitePress"
  text: "test deploy VitePress page"
  actions:
    - theme: brand
      text: README.md
      link: /README
    # - theme: alt
    #   text: API Examples
    #   link: /api-examples

features:
  - title: CHANGELOG
    details: project CHANGELOG.md
    link: /CHANGELOG
  - title: Test Report
    details: Jest unit test report
    link: /lcov-report/index.html
    target: '_self'
  - title: Code Coverage Report
    details: Jest Code Coverage Report
    link: /test-results/jest/index.html
    target: '_self'
---

