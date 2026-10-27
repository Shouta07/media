# -*- coding: utf-8 -*-
"""index.html（日本語・唯一の正）から /en/index.html と /zh/index.html を生成する。

    python3 tools/i18n/build.py

/en/ と /zh/ は手で編集しない。日本語版を直してから必ずこれを実行すること。
未翻訳の文字列が残った場合は標準出力に一覧が出る。tables.py に追記して再実行する。
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tables import TEXT, ATTR  # noqa: E402

SITE = 'https://www.vitality-design.jp'

# --------------------------------------------------------------------- 各言語の設定
HEAD = {
    'en': dict(
        lang='en',
        canon=SITE + '/en/',
        title='Creating experiences that exist only there. | Vitality Design LLC',
        desc=('Vitality Design connects the value scattered across a region and creates the experience '
              'that only that place can give rise to. Connecting places, people, culture and technology, '
              'we create a new circulation between the world and the local.'),
        ogd=('Connecting places, people, culture and technology to create a new circulation between the '
             'world and the local. Made locally. Connected globally.'),
    ),
    'zh': dict(
        lang='zh-Hans',
        canon=SITE + '/zh/',
        title='创造只有在那里才能实现的体验。｜Vitality Design 合同会社',
        desc=('Vitality Design 连接散落于地域中的价值，创造只有那个场所才能孕育的体验。'
              '连接场所、人、文化与技术，创造世界与地域之间新的循环。'),
        ogd='连接场所、人、文化与技术，创造世界与地域之间新的循环。Made locally. Connected globally.',
    ),
}

# 日本語版は Shippori Mincho（見出し）+ Noto Sans JP（本文）。
# 英語は欧文セリフ、中国語は Noto Serif/Sans SC に差し替える。
FONTS = {
    'en': (
        'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600'
        '&amp;family=Inter:wght@400;500;600&amp;display=swap',
        ":root{--mi:'Cormorant Garamond',Georgia,serif;--se:'Inter',system-ui,sans-serif}\n"
        ".dh{letter-spacing:0;line-height:1.24}\n"
        ".d1{font-size:clamp(34px,5.6vw,76px)}.d2{font-size:clamp(27px,3.9vw,52px)}\n"
        ".d3{font-size:clamp(20px,2.3vw,31px);line-height:1.32}\n"
        ".hero h1{font-size:clamp(38px,6.4vw,88px);line-height:1.14;letter-spacing:0}\n"
        ".hero h1 .ln:last-child{padding-left:0}\n"
        ".hero-l{letter-spacing:0;line-height:1.35}\n"
        ".creed{letter-spacing:0;line-height:1.38}\n"
        ".exists li,.creates li,.forwhat li,.roles li,.impact4 span,.steps4 h3,.cycle span{letter-spacing:0}"
    ),
    'zh': (
        'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600'
        '&amp;family=Inter:wght@400;500;600&amp;family=Noto+Sans+SC:wght@300;400;500'
        '&amp;family=Noto+Serif+SC:wght@400;500&amp;display=swap',
        ":root{--mi:'Noto Serif SC','Songti SC',serif;--se:'Noto Sans SC','PingFang SC',sans-serif}\n"
        ".dh{letter-spacing:.015em}\n.hero h1{letter-spacing:.03em}"
    ),
}

# assets/site.js が読む文言。ページ内 <script>window.VD_S={...}</script> に差し込む。
STRINGS = {
    'en': """{menuO:'Open menu',menuC:'Close menu',
f1:'Company or organisation',f2:'Your name',f3:'Email address',sep:', ',
eReq:'Please complete: ',eMail:'Please check the format of your email address.',
sending:'Sending\\u2026',eSend:'We could not send your message. Please write directly to contact@vitality-design.jp.',
submit:'Send enquiry'}""",
    'zh': """{menuO:'打开菜单',menuC:'关闭菜单',
f1:'公司名・团体名',f2:'姓名',f3:'电子邮箱',sep:'、',
eReq:'有未填写的项目：',eMail:'请确认电子邮箱的格式。',
sending:'发送中…',eSend:'发送失败。烦请直接联系 contact@vitality-design.jp。',
submit:'发送咨询'}""",
}

# JSON-LD（構造化データ）の本文。日本語版の該当フィールドを丸ごと差し替える。
LD_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'jsonld.json')
LD = json.load(io.open(LD_PATH, encoding='utf-8'))

JA = re.compile(r'[぀-ヿ一-鿿]')   # かな + 漢字
KANA = re.compile(r'[぀-ヿ]')              # かなのみ（中国語版は漢字を許す）


def build(lang):
    src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    idx = 1 if lang == 'en' else 2
    h = HEAD[lang]
    l = LD[lang]
    s = src

    # ---- <head> ----
    s = s.replace('<html lang="ja">', '<html lang="%s">' % h['lang'])
    s = re.sub(r'<title>[^<]*</title>', lambda m: '<title>%s</title>' % h['title'], s, count=1)
    s = re.sub(r'<meta name="description" content="[^"]*">',
               lambda m: '<meta name="description" content="%s">' % h['desc'], s, count=1)
    for k in ('og:title', 'twitter:title'):
        s = re.sub(r'(<meta (?:property|name)="%s" content=")[^"]*(">)' % k,
                   lambda m: m.group(1) + h['title'] + m.group(2), s)
    for k in ('og:description', 'twitter:description'):
        s = re.sub(r'(<meta (?:property|name)="%s" content=")[^"]*(">)' % k,
                   lambda m: m.group(1) + h['ogd'] + m.group(2), s)
    s = re.sub(r'(<meta property="og:image:alt" content=")[^"]*(">)',
               lambda m: m.group(1) + h['title'] + m.group(2), s)
    s = s.replace('<link rel="canonical" href="%s/">' % SITE,
                  '<link rel="canonical" href="%s">' % h['canon'])
    s = s.replace('<meta property="og:url" content="%s/">' % SITE,
                  '<meta property="og:url" content="%s">' % h['canon'])
    s = s.replace('%s/og.png' % SITE, '%s/og-%s.png' % (SITE, lang))

    # ---- フォント（言語別の上書きを site.css の後ろに挿す） ----
    url, extra = FONTS[lang]
    s = re.sub(r'https://fonts\.googleapis\.com/css2\?family=Cormorant\+Garamond[^"]*', url, s)
    s = s.replace('<link rel="stylesheet" href="/assets/site.css">',
                  '<link rel="stylesheet" href="/assets/site.css">\n<style>%s</style>' % extra)

    # ---- JS が読む文言 ----
    m = re.search(r'<script>window\.VD_S=\{[\s\S]*?\};</script>', s)
    s = s[:m.start()] + '<script>window.VD_S=' + STRINGS[lang] + ';</script>' + s[m.end():]

    # ---- 言語スイッチャの現在地 ----
    for ja_markup, per_lang in (
        ('<a href="/" aria-current="true">JA</a><a href="/en/">EN</a><a href="/zh/">中文</a>',
         {'en': '<a href="/">JA</a><a href="/en/" aria-current="true">EN</a><a href="/zh/">中文</a>',
          'zh': '<a href="/">JA</a><a href="/en/">EN</a><a href="/zh/" aria-current="true">中文</a>'}),
        ('<a href="/" aria-current="true">日本語</a><a href="/en/">English</a><a href="/zh/">中文</a>',
         {'en': '<a href="/">日本語</a><a href="/en/" aria-current="true">English</a><a href="/zh/">中文</a>',
          'zh': '<a href="/">日本語</a><a href="/en/">English</a><a href="/zh/" aria-current="true">中文</a>'}),
    ):
        s = s.replace(ja_markup, per_lang[lang])

    # ---- 本文の置換（長い文字列から順に。短い語が長い文の一部を壊さないため） ----
    for row in sorted(TEXT, key=lambda r: -len(r[0])):
        ja, tr = row[0], row[idx]
        s = re.sub(r'>(\s*)' + re.escape(ja) + r'(\s*)<',
                   lambda m: '>' + m.group(1) + tr + m.group(2) + '<', s)
    for row in sorted(ATTR, key=lambda r: -len(r[0])):
        s = s.replace('="' + row[0] + '"', '="' + row[idx] + '"')
    for row in sorted(TEXT, key=lambda r: -len(r[0])):
        s = s.replace('="' + row[0] + '"', '="' + row[idx] + '"')

    # ---- JSON-LD ----
    m = re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', s)
    g = json.loads(m.group(1))
    for n in g['@graph']:
        t = n.get('@type')
        if t == 'Organization':
            n['description'] = l['org']
            n['slogan'] = l['slogan']
            n['knowsAbout'] = l['knows']
        elif t == 'Person':
            n['description'] = l['person']
        elif t == 'WebPage':
            n['name'] = l['pname']
            n['description'] = l['page']
            n['@id'] = h['canon'] + '#webpage'
            n['url'] = h['canon']
        elif t == 'Service':
            n['name'] = l['svcname']
            n['serviceType'] = l['svctype']
            n['description'] = l['svc']
        elif t == 'BreadcrumbList':
            n['itemListElement'][0]['name'] = l['home']
            n['itemListElement'][0]['item'] = h['canon']
        if 'inLanguage' in n:
            n['inLanguage'] = h['lang']
    s = s[:m.start(1)] + json.dumps(g, ensure_ascii=False, separators=(',', ':')) + s[m.end(1):]

    # ---- 言語ごとの細かい調整 ----
    if lang == 'en':
        # 日本語では <br> で改行していた箇所が、英語では単語が繋がるので空白を補う
        s = s.replace('<br class="sp-br">', '<br class="sp-br"> ')
    if lang == 'zh':
        s = s.replace('・', '·')  # 中黒 → 間隔点

    out = os.path.join(ROOT, lang, 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    io.open(out, 'w', encoding='utf-8').write(s)
    return out, leftovers(s, lang)


def leftovers(s, lang):
    """訳し漏れを拾う。JSON-LD・言語スイッチャ・<script>・<style> は対象外。"""
    chk = re.sub(r'<script type="application/ld\+json">[\s\S]*?</script>', '', s)
    chk = re.sub(r'<div class="lang[\s\S]*?</div>', '', chk)
    chk = re.sub(r'<script>[\s\S]*?</script>', '', chk)
    chk = re.sub(r'<style>[\s\S]*?</style>', '', chk)
    det = KANA if lang == 'zh' else JA
    found = []
    for t in re.split(r'<[^>]*>', chk):
        t = t.strip()
        if t and det.search(t):
            found.append(t)
    for m in re.finditer(r'(?:aria-label|placeholder|alt|title|value|content|data-topic)="([^"]*)"', chk):
        if det.search(m.group(1)):
            found.append('[attr] ' + m.group(1))
    return found


if __name__ == '__main__':
    fail = 0
    for lang in ('en', 'zh'):
        out, left = build(lang)
        print('%s -> %s  未翻訳 %d件' % (lang, os.path.relpath(out, ROOT), len(left)))
        for x in left:
            fail = 1
            print('    ! ' + x)
    if fail:
        print('\ntools/i18n/tables.py に上記を追記して、もう一度実行してください。')
    sys.exit(fail)
