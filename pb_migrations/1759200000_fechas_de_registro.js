/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   CUÁNDO SE CREÓ Y CUÁNDO SE TOCÓ CADA REGISTRO
   ------------------------------------------------------------
   El esquema inicial declaró los campos del negocio y dio por hecho que
   "created" y "updated" venían incluidos. No vienen: desde PocketBase
   0.23 hay que declararlos como campos autodate. Al no existir:

   - Cualquier consulta con sort=-created devolvía 400, y el sitio pide
     ese orden en dos lugares (arranque.js, postulaciones). Eso tumbaba
     el área privada completa y el panel de administración, porque las
     consultas van dentro de un Promise.all: una sola que falla deja la
     pantalla en el mensaje de error.
   - La ficha mostraba fecha vacía y la postulación sin fecha caía a
     "NaN de undefined".
   - No había forma de saber la antigüedad de la cola de validación, que
     es justo lo que hay que vigilar para que nadie quede esperando.

   Se agregan a las tres colecciones y se rellenan las filas que ya
   existen, porque un campo autodate nuevo nace vacío en lo ya guardado.
   ============================================================ */

migrate(function (app) {

  ['fichas', 'oportunidades', 'postulaciones'].forEach(function (nombre) {
    var c = app.findCollectionByNameOrId(nombre);

    if (!c.fields.getByName('created')) {
      c.fields.add(new Field({
        name: 'created', type: 'autodate', onCreate: true, onUpdate: false
      }));
    }
    if (!c.fields.getByName('updated')) {
      c.fields.add(new Field({
        name: 'updated', type: 'autodate', onCreate: true, onUpdate: true
      }));
    }

    /* El orden por fecha se va a pedir en cada pantalla de listado. */
    var idx = 'CREATE INDEX idx_' + nombre + '_created ON ' + nombre + ' (created)';
    if (c.indexes.indexOf(idx) === -1) {
      c.indexes.push(idx);
    }

    app.save(c);
  });

  /* Las filas que ya existían quedan con el campo vacío. Se les pone una
     fecha plausible en vez de dejarlas en blanco: para las postulaciones,
     la fecha que ya guardaba el hook; para el resto, el momento de esta
     migración, que es lo más honesto que se puede afirmar. */
  var ahora = new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';

  app.db().newQuery(
    "UPDATE postulaciones SET created = COALESCE(NULLIF(fecha, '') || ' 12:00:00Z', {:ahora}) " +
    "WHERE created IS NULL OR created = ''"
  ).bind({ ahora: ahora }).execute();

  app.db().newQuery(
    "UPDATE postulaciones SET updated = created WHERE updated IS NULL OR updated = ''"
  ).execute();

  ['fichas', 'oportunidades'].forEach(function (nombre) {
    app.db().newQuery(
      'UPDATE ' + nombre + ' SET created = {:ahora} WHERE created IS NULL OR created = \'\''
    ).bind({ ahora: ahora }).execute();
    app.db().newQuery(
      'UPDATE ' + nombre + ' SET updated = created WHERE updated IS NULL OR updated = \'\''
    ).execute();
  });

}, function (app) {
  ['fichas', 'oportunidades', 'postulaciones'].forEach(function (nombre) {
    try {
      var c = app.findCollectionByNameOrId(nombre);
      var idx = 'CREATE INDEX idx_' + nombre + '_created ON ' + nombre + ' (created)';
      var pos = c.indexes.indexOf(idx);
      if (pos !== -1) c.indexes.splice(pos, 1);
      ['created', 'updated'].forEach(function (campo) {
        var f = c.fields.getByName(campo);
        if (f) c.fields.removeById(f.id);
      });
      app.save(c);
    } catch (e) {}
  });
});
