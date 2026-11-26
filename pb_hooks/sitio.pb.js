/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   BORRAR OPORTUNIDADES Y MAPA DEL SITIO (26-nov)
   ------------------------------------------------------------
   La lección de siempre: cada hook corre en su propio contexto y no ve
   nada declarado fuera, así que cada uno trae todo lo que necesita.
   ============================================================ */

/* 1. Una oportunidad con postulaciones no se borra.
      Las postulaciones guardan la historia de quién postuló, quién quedó
      y quién pagó; borrar la oportunidad las dejaría colgando, y por eso
      la base ya lo impedía con un error en inglés. Acá se explica en
      castellano. El panel solo ofrece borrar las que no tienen. */
onRecordDeleteRequest(function (e) {
  var n = $app.findRecordsByFilter(
    'postulaciones', 'oportunidad = {:o}', '', 0, 0, { o: e.record.id }).length;
  if (n > 0) {
    throw new BadRequestError(
      'No se puede borrar: tiene ' + n + (n === 1 ? ' postulación' : ' postulaciones') +
      ' y se perdería su historial. Queda en el panel, en "Terminadas y suspendidas".');
  }
  e.next();
}, 'oportunidades');

/* 2. Mapa del sitio para Google.
      Va en el backend y no como archivo fijo porque las oportunidades
      cambian: así cada convocatoria publicada entra sola. robots.txt del
      sitio lo declara con su dirección completa, que es la forma en que
      Google acepta un mapa en otro subdominio del mismo dominio.

      Mientras el sitio diga que sus datos son de ejemplo, el detalle de
      cada oportunidad se marca "noindex" desde la página (detalle.js), así
      que Google lee el mapa pero no indexa una feria ficticia. */
routerAdd('GET', '/api/eu/sitemap.xml', function (e) {
  var SITIO = 'https://equipouni.cl/';
  var FIJAS = [
    ['', 'daily', '1.0'],
    ['oportunidades.html', 'daily', '0.9'],
    ['emprendedores.html', 'monthly', '0.7'],
    ['productoras.html', 'monthly', '0.7'],
    ['nosotros.html', 'monthly', '0.5'],
    ['registro.html', 'monthly', '0.5'],
    ['privacidad.html', 'yearly', '0.2'],
    ['terminos.html', 'yearly', '0.2']
  ];
  function x(s) {
    return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
  }
  var filas = FIJAS.map(function (f) {
    return '<url><loc>' + SITIO + f[0] + '</loc><changefreq>' + f[1] +
           '</changefreq><priority>' + f[2] + '</priority></url>';
  });
  var ops = $app.findRecordsByFilter('oportunidades', 'estado = "publicada"', '-updated', 500, 0);
  for (var i = 0; i < ops.length; i++) {
    var actualizada = String(ops[i].get('updated') || '').slice(0, 10);
    filas.push('<url><loc>' + x(SITIO + 'oportunidad.html?id=' + ops[i].id) + '</loc>' +
      (actualizada ? '<lastmod>' + actualizada + '</lastmod>' : '') +
      '<changefreq>weekly</changefreq><priority>0.8</priority></url>');
  }
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    filas.join('\n') + '\n</urlset>\n';
  e.response.header().set('Content-Type', 'application/xml; charset=utf-8');
  e.response.header().set('Cache-Control', 'public, max-age=3600');
  return e.string(200, xml);
});
