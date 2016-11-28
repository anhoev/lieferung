#!/usr/bin/env bash
git commit -a -m 'update'
git push
curl -i -H "Accept: application/json" -H "Content-Type: application/json" -X GET http://192.168.1.12:4444/debug