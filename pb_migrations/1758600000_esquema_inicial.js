/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   ESQUEMA INICIAL DE EQUIPOUNI
   ------------------------------------------------------------
   Tres colecciones propias más la de usuarios que trae PocketBase:

     users          quien entra al sitio (emprendedor o administrador)
     fichas         la ficha única del emprendimiento, una por usuario
     oportunidades  las convocatorias que publica EquipoUni
     postulaciones  vincula una ficha con una oportunidad

   Los nombres de campo son los mismos que ya usa el front en sus
   archivos de datos, para que conectar sea cambiar de dónde vienen
   y no reescribir las pantallas.

   Reglas de acceso, en una línea: cada emprendedor ve y edita solo lo
   suyo; el administrador ve y edita todo; las oportunidades publicadas
   las puede leer cualquiera, incluso sin cuenta.
   ============================================================ */

migrate(function (app) {

  /* ---------- users: se agrega el rol y datos de contacto ---------- */
  var users = app.findCollectionByNameOrId('users');

  users.fields.add(new Field({
    name: 'rol', type: 'select', required: true, maxSelect: 1,
    values: ['emprendedor', 'admin']
  }));
  users.fields.add(new Field({ name: 'nombre', type: 'text', max: 120 }));
  users.fields.add(new Field({ name: 'telefono', type: 'text', max: 30 }));

  /* Nadie lista usuarios salvo el administrador; cada uno se ve a sí mismo. */
  users.listRule = '@request.auth.rol = "admin"';
  users.viewRule = 'id = @request.auth.id || @request.auth.rol = "admin"';
  users.updateRule = 'id = @request.auth.id || @request.auth.rol = "admin"';
  users.deleteRule = '@request.auth.rol = "admin"';
  app.save(users);

  /* ---------- fichas ---------- */
  var fichas = new Collection({
    type: 'base',
    name: 'fichas',
    fields: [
      { name: 'usuario', type: 'relation', required: true, maxSelect: 1,
        collectionId: users.id, cascadeDelete: true },

      { name: 'estado', type: 'select', required: true, maxSelect: 1,
        values: ['incompleta', 'pendiente', 'validada', 'correccion', 'suspendida'] },

      /* Quién representa */
      { name: 'representante_nombre', type: 'text', max: 120 },
      { name: 'representante_rut', type: 'text', max: 15 },
      { name: 'representante_telefono', type: 'text', max: 30 },
      { name: 'representante_comuna', type: 'text', max: 8 },
      { name: 'contacto_preferido', type: 'select', maxSelect: 1,
        values: ['whatsapp', 'correo', 'telefono'] },

      /* El emprendimiento */
      { name: 'emp_nombre', type: 'text', max: 120 },
      { name: 'emp_comuna', type: 'text', max: 8 },
      { name: 'emp_ano_inicio', type: 'number', onlyInt: true, min: 1950, max: 2100 },
      { name: 'emp_descripcion', type: 'text', max: 600 },
      { name: 'emp_instagram', type: 'url' },

      /* Clasificación: el rubro es uno, los subrubros y tipos son varios */
      { name: 'cla_rubro', type: 'text', max: 40 },
      { name: 'cla_subrubros', type: 'json', maxSize: 2000 },
      { name: 'cla_tipos', type: 'json', maxSize: 4000 },
      { name: 'cla_otro_detalle', type: 'text', max: 200 },

      /* Productos */
      { name: 'fotos', type: 'file', maxSelect: 8, maxSize: 5242880,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
      { name: 'personaliza', type: 'bool' },
      { name: 'personaliza_detalle', type: 'text', max: 200 },

      /* Formalización */
      { name: 'for_inicio_actividades', type: 'bool' },
      { name: 'for_boleta', type: 'bool' },
      { name: 'for_patente', type: 'bool' },
      { name: 'for_resolucion_sanitaria', type: 'bool' },
      { name: 'for_personalidad_juridica', type: 'bool' },
      { name: 'documentos', type: 'file', maxSelect: 6, maxSize: 10485760,
        mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'] },

      /* Observaciones del revisor, por sección */
      { name: 'observaciones', type: 'json', maxSize: 4000 }
    ],
    indexes: [
      /* Una ficha por usuario: lo garantiza la base, no el formulario. */
      'CREATE UNIQUE INDEX idx_fichas_usuario ON fichas (usuario)'
    ],

    listRule:   'usuario = @request.auth.id || @request.auth.rol = "admin"',
    viewRule:   'usuario = @request.auth.id || @request.auth.rol = "admin"',
    createRule: '@request.auth.id != "" && usuario = @request.auth.id',
    /* El emprendedor edita la suya; el estado solo lo cambia el admin,
       eso se controla en la capa de aplicación y se revisa en el panel. */
    updateRule: 'usuario = @request.auth.id || @request.auth.rol = "admin"',
    deleteRule: '@request.auth.rol = "admin"'
  });
  app.save(fichas);

  /* ---------- oportunidades ---------- */
  var oportunidades = new Collection({
    type: 'base',
    name: 'oportunidades',
    fields: [
      { name: 'nombre', type: 'text', required: true, max: 160 },
      { name: 'tipo', type: 'text', required: true, max: 40 },
      { name: 'organizacion', type: 'text', required: true, max: 160 },
      { name: 'estado', type: 'select', required: true, maxSelect: 1,
        values: ['borrador', 'vista_previa', 'publicada', 'cerrada', 'cancelada'] },

      { name: 'modalidad', type: 'text', max: 30 },
      { name: 'region', type: 'text', max: 4 },
      { name: 'comuna', type: 'text', max: 8 },
      { name: 'direccion', type: 'text', max: 200 },
      { name: 'lugar', type: 'text', max: 160 },

      { name: 'fecha_inicio', type: 'text', max: 10 },
      { name: 'fecha_termino', type: 'text', max: 10 },
      { name: 'horario', type: 'text', max: 60 },

      { name: 'cupos', type: 'number', onlyInt: true, min: 0 },
      { name: 'cupos_disponibles', type: 'number', onlyInt: true, min: 0 },
      { name: 'valor', type: 'number', onlyInt: true, min: 0 },
      { name: 'que_incluye', type: 'json', maxSize: 2000 },
      { name: 'que_no_incluye', type: 'json', maxSize: 2000 },

      { name: 'cierre_postulacion', type: 'text', max: 10 },
      { name: 'plazo_pago', type: 'text', max: 200 },
      { name: 'asistencia', type: 'text', max: 200 },
      { name: 'cancelacion', type: 'text', max: 200 },

      { name: 'rubros_buscados', type: 'json', maxSize: 2000 },
      { name: 'subrubros_buscados', type: 'json', maxSize: 3000 },
      { name: 'requisitos', type: 'json', maxSize: 3000 },

      { name: 'imagen', type: 'file', maxSelect: 1, maxSize: 5242880,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
      { name: 'imagen_alt', type: 'text', max: 200 },
      { name: 'descripcion', type: 'text', max: 1500 },

      /* Las preguntas particulares de esta oportunidad */
      { name: 'preguntas', type: 'json', maxSize: 8000 },

      { name: 'responsable', type: 'text', max: 120 },
      { name: 'orden', type: 'number', onlyInt: true }
    ],
    indexes: [
      'CREATE INDEX idx_oportunidades_estado ON oportunidades (estado)',
      'CREATE INDEX idx_oportunidades_cierre ON oportunidades (cierre_postulacion)'
    ],

    /* El tablero es público: se pueden ver sin tener cuenta, pero solo
       las que ya están publicadas. Los borradores quedan para el panel. */
    listRule:   'estado = "publicada" || estado = "cerrada" || estado = "cancelada" || @request.auth.rol = "admin"',
    viewRule:   'estado = "publicada" || estado = "cerrada" || estado = "cancelada" || @request.auth.rol = "admin"',
    createRule: '@request.auth.rol = "admin"',
    updateRule: '@request.auth.rol = "admin"',
    deleteRule: '@request.auth.rol = "admin"'
  });
  app.save(oportunidades);

  /* ---------- postulaciones ---------- */
  var postulaciones = new Collection({
    type: 'base',
    name: 'postulaciones',
    fields: [
      { name: 'oportunidad', type: 'relation', required: true, maxSelect: 1,
        collectionId: oportunidades.id, cascadeDelete: false },
      { name: 'ficha', type: 'relation', required: true, maxSelect: 1,
        collectionId: fichas.id, cascadeDelete: true },

      { name: 'estado', type: 'select', required: true, maxSelect: 1,
        values: ['postulado', 'seleccionado', 'confirmado', 'renuncio'] },
      /* "renuncio" debe conservar de dónde venía, lo exige la especificación */
      { name: 'estado_anterior', type: 'text', max: 20 },

      { name: 'respuestas', type: 'json', maxSize: 6000 },
      { name: 'historial', type: 'json', maxSize: 6000 },
      { name: 'fecha', type: 'text', max: 10 }
    ],
    indexes: [
      /* Un emprendimiento no puede postular dos veces a la misma
         oportunidad: regla de la especificación, garantizada por la base. */
      'CREATE UNIQUE INDEX idx_postulacion_unica ON postulaciones (oportunidad, ficha)',
      'CREATE INDEX idx_postulaciones_estado ON postulaciones (estado)'
    ],

    listRule:   'ficha.usuario = @request.auth.id || @request.auth.rol = "admin"',
    viewRule:   'ficha.usuario = @request.auth.id || @request.auth.rol = "admin"',
    /* Solo se postula con ficha propia y validada, y a una oportunidad
       que siga publicada. El plazo se revisa además en la aplicación. */
    createRule: '@request.auth.id != "" && ficha.usuario = @request.auth.id' +
                ' && ficha.estado = "validada" && oportunidad.estado = "publicada"',
    /* Los cambios de estado los hace EquipoUni, no el postulante. */
    updateRule: '@request.auth.rol = "admin"',
    deleteRule: '@request.auth.rol = "admin"'
  });
  app.save(postulaciones);

}, function (app) {
  /* Deshacer: se borran las colecciones propias y se limpian los campos
     agregados a users. */
  ['postulaciones', 'oportunidades', 'fichas'].forEach(function (nombre) {
    try { app.delete(app.findCollectionByNameOrId(nombre)); } catch (e) {}
  });
  try {
    var users = app.findCollectionByNameOrId('users');
    ['rol', 'nombre', 'telefono'].forEach(function (campo) {
      var f = users.fields.getByName(campo);
      if (f) users.fields.removeById(f.id);
    });
    users.listRule = null; users.viewRule = null;
    users.updateRule = null; users.deleteRule = null;
    app.save(users);
  } catch (e) {}
});
