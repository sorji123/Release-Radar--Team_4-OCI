import json
import tempfile
import threading
import unittest
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import urlopen, Request
from zipfile import ZipFile

from release_radar.pipeline import ROOT
from release_radar.site import build_site, check_latest, ReadinessParser, SiteHandler


class WebsiteBuildTests(unittest.TestCase):
    def test_payload_matches_versioned_data_and_zip_is_static_only(self):
        before=(ROOT/'web/rr-data.js').read_text()
        bundle=build_site()
        self.assertEqual(before,(ROOT/'web/rr-data.js').read_text())
        with ZipFile(bundle) as z:
            self.assertEqual(set(z.namelist()),{'rr-core.js','rr-data.js','rr-app.js','rr-style.css','icon.svg'})
            self.assertNotIn(b'authApexworkspace',z.read('rr-data.js'))

    def test_current_release_detection_excludes_old_revisions(self):
        html='<h2>Features introduced October 2026</h2><a href="/sales">Sales 26D</a><a href="/service">Service 26D</a><h2>Recently revised readiness content</h2><a href="/old">Example 27A</a>'
        self.assertEqual(check_latest(lambda:html)['latest_release'],'26D')

    def test_absent_live_release_does_not_invent_a_current_quarter(self):
        with self.assertRaisesRegex(ValueError,'could not be identified'):
            check_latest(lambda:'<h2>Other announcements</h2><a href="/x">27A</a>')

    def test_new_year_release_orders_correctly(self):
        html='<h2>Features introduced January 2027</h2><a href="/x">Sales 27A</a><a href="/y">Service 26D</a>'
        self.assertEqual(check_latest(lambda:html)['latest_release'],'27A')


class LocalPreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(SiteHandler,directory=str(ROOT/'web')))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join()

    def test_public_asset_is_served(self):
        with urlopen(self.url+'/') as r:
            self.assertEqual(r.status,200)
            self.assertIn(b'id="release-radar"',r.read())
            self.assertEqual(r.headers['X-Content-Type-Options'],'nosniff')

    def test_private_repo_files_and_traversal_are_not_served(self):
        for path in ('/authApexworkspace','/../authApexworkspace','/%2e%2e/authApexworkspace','/.git/config','/config/oci-embedding.example.json'):
            with self.subTest(path=path),self.assertRaises(HTTPError) as ctx:
                urlopen(self.url+path)
            self.assertEqual(ctx.exception.code,404)

    def test_uploads_are_not_accepted_by_server(self):
        with self.assertRaises(HTTPError) as ctx:
            urlopen(Request(self.url+'/',data=b'customer data',method='POST'))
        self.assertEqual(ctx.exception.code,501)

    def test_latest_endpoint_and_unavailable_state(self):
        SiteHandler.readiness_cache=None
        with patch('release_radar.site.check_latest',return_value={'latest_release':'27A'}):
            with urlopen(self.url+'/api/release-status') as r:
                self.assertEqual(json.load(r)['latest_release'],'27A')
        SiteHandler.readiness_cache=None
        with patch('release_radar.site.check_latest',side_effect=OSError('offline')):
            with self.assertRaises(HTTPError) as ctx:
                urlopen(self.url+'/api/release-status')
            self.assertEqual(ctx.exception.code,503)
            self.assertNotIn('latest_release',json.load(ctx.exception))
        SiteHandler.readiness_cache=None


if __name__=='__main__': unittest.main()
