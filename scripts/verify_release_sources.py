"""Check that each brief catalog excerpt is still present on its Oracle page."""

from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parent.parent


class Text(HTMLParser):
    def __init__(self):
        super().__init__();self.parts=[];self.hidden=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style'):self.hidden+=1
    def handle_endtag(self,tag):
        if tag in ('script','style'):self.hidden=max(0,self.hidden-1)
    def handle_data(self,data):
        if not self.hidden:self.parts.append(data)


def check(feature):
    url=feature['source_url']
    if urlparse(url).hostname!='docs.oracle.com' or urlparse(url).scheme!='https':
        return feature['id'],False,'Invalid source host'
    try:
        with urlopen(Request(url,headers={'User-Agent':'ReleaseRadar/0.2 source-check'}),timeout=15) as response:
            if urlparse(response.geturl()).hostname!='docs.oracle.com':
                raise ValueError('Unexpected source redirect')
            source=response.read(2_000_000).decode('utf-8')
        parser=Text();parser.feed(source)
        # Inline emphasis can separate a word from its following punctuation.
        rendered = re.sub(r'\s+([,.;:!?])', r'\1', ' '.join(' '.join(parser.parts).split()))
        found=' '.join(feature['quote'].split()) in rendered
        return feature['id'],found,'Excerpt verified' if found else 'Excerpt missing; review source changes'
    except Exception as error:
        return feature['id'],False,str(error)


def main():
    catalog=json.loads((ROOT/'data/releases/26D.json').read_text())
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(check,catalog['features']))
    for name,ok,message in results:print(f'{"PASS" if ok else "FAIL"} {name}: {message}')
    return 0 if all(ok for _,ok,_ in results) else 1


if __name__=='__main__':sys.exit(main())
