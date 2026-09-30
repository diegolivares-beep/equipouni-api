/// <reference path="../pb_data/types.d.ts" />

/* ============================================================
   LOS CAMBIOS QUE PIDIO EL CLIENTE EL 30-SEP
   ------------------------------------------------------------
   Hyoanni pidio doce cosas por WhatsApp y Diego se las dio como uso
   del cupo de cambios del nivel B. Lo que toca el esquema:

   1. EL CATALOGO DEJA DE VIVIR EN EL CODIGO.
      Hasta hoy los 12 rubros y sus 53 subrubros estaban escritos en
      config/catalogo.js, con un comentario que decia "no se cambian sin
      avisarle al cliente". El cliente quiere poder agregarlos el mismo,
      a medida que aparezcan emprendimientos que no calzan en ninguno.
      Pasan a la coleccion "catalogo", plana y con padre, y se siembran
      con exactamente los mismos identificadores que ya usan las fichas
      existentes: por eso la semilla de aca abajo se genero leyendo ese
      archivo, no copiandola a mano.

   2. EL RUBRO YA NO LO ELIGE EL EMPRENDEDOR.
      Lo asigna el equipo al validar. Entonces el emprendedor necesita
      otra forma de decir que vende, y de ahi cla_que_vende: texto libre
      que es la materia prima de la clasificacion. Sin ese campo la
      validacion se queda sin nada desde donde decidir.

   3. Campos nuevos de la ficha: etiquetas libres que pone el revisor,
      logo del emprendimiento, los 3 productos mas vendidos, y una
      segunda direccion de redes o web (habia solo Instagram).

   4. Datos de transferencia por oportunidad. No es una pasarela: es el
      texto que viaja al aviso de seleccion para que la persona sepa
      donde pagar y a donde mandar el comprobante.

   5. Plantillas de los tres correos automaticos, en la base y no en el
      codigo, porque el cliente pidio poder editarlos despues.

   6. aviso_estado en fichas y postulaciones: guarda de que estado ya se
      avisó. Es lo que hace que el correo salga una sola vez y que se
      pueda saber a quien se le avisó qué, sin depender de comparar
      contra un valor anterior que en un hook posterior al guardado ya
      no existe.
   ============================================================ */

migrate(function (app) {

  /* ---------- 1. catalogo ----------
     Plano y con "padre" en vez de anidado: asi un subrubro se mueve de
     rubro cambiando un campo, y agregar un nivel mas no obliga a migrar
     la estructura. La lectura es publica porque son nombres de
     categorias, que hoy ya viajan en un archivo .js publico. */
  var cat = new Collection({
    type: 'base',
    name: 'catalogo',
    fields: [
      { name: 'clave', type: 'text', required: true, max: 40 },
      { name: 'nombre', type: 'text', required: true, max: 120 },
      /* Vacio = es un rubro. Con valor = es subrubro de esa clave. */
      { name: 'padre', type: 'text', max: 40 },
      { name: 'aviso', type: 'text', max: 300 },
      { name: 'tipos', type: 'json', maxSize: 4000 },
      { name: 'orden', type: 'number', onlyInt: true },
      { name: 'activo', type: 'bool' }
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_catalogo_clave ON catalogo (clave)',
      'CREATE INDEX idx_catalogo_padre ON catalogo (padre)'
    ],
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.rol = "admin"',
    updateRule: '@request.auth.rol = "admin"',
    deleteRule: '@request.auth.rol = "admin"'
  });
  app.save(cat);

  /* Semilla generada desde config/catalogo.js. Las claves son las mismas
     que ya tienen guardadas las fichas: si se cambian, las fichas
     existentes quedan apuntando a categorias que no existen. */
  var SEMILLA = [
  {"clave":"tejido-confeccion","nombre":"Tejido y confección","padre":"","aviso":"","tipos":[],"orden":10},
  {"clave":"telar-tejido","nombre":"Telar y tejido a mano","padre":"tejido-confeccion","aviso":"","tipos":["Telar","Tejido a palillo","Crochet","Macramé"],"orden":10},
  {"clave":"ropa","nombre":"Ropa","padre":"tejido-confeccion","aviso":"","tipos":["Mujer","Hombre","Infantil","Sin género","Talla amplia"],"orden":20},
  {"clave":"ropa-infantil","nombre":"Ropa de bebé y niños","padre":"tejido-confeccion","aviso":"","tipos":["Ajuar","Mudas","Gorros y zapatitos"],"orden":30},
  {"clave":"bordado","nombre":"Bordado y aplicaciones","padre":"tejido-confeccion","aviso":"","tipos":["Bordado a mano","Bordado a máquina","Parches"],"orden":40},
  {"clave":"fieltro","nombre":"Fieltro y lana","padre":"tejido-confeccion","aviso":"","tipos":["Fieltro","Lana afieltrada","Muñequería"],"orden":50},
  {"clave":"artesania","nombre":"Artesanía y manualidades","padre":"","aviso":"","tipos":[],"orden":20},
  {"clave":"ceramica","nombre":"Cerámica y greda","padre":"artesania","aviso":"","tipos":["Vajilla","Macetas","Figuras","Piezas decorativas"],"orden":10},
  {"clave":"madera","nombre":"Madera","padre":"artesania","aviso":"","tipos":["Utensilios","Juguetes","Muebles pequeños","Tallado"],"orden":20},
  {"clave":"cuero","nombre":"Cuero y marroquinería","padre":"artesania","aviso":"","tipos":["Billeteras","Cinturones","Calzado","Cuadernos"],"orden":30},
  {"clave":"vidrio","nombre":"Vidrio y mosaico","padre":"artesania","aviso":"","tipos":["Vitrofusión","Mosaico","Vitral"],"orden":40},
  {"clave":"metal","nombre":"Metal y alambre","padre":"artesania","aviso":"","tipos":["Herrería decorativa","Alambrismo"],"orden":50},
  {"clave":"reciclado","nombre":"Reciclado y restauración","padre":"artesania","aviso":"","tipos":["Objetos reciclados","Muebles restaurados"],"orden":60},
  {"clave":"accesorios-joyeria","nombre":"Accesorios, joyería y bisutería","padre":"","aviso":"","tipos":[],"orden":30},
  {"clave":"joyeria-metal","nombre":"Joyería en metal","padre":"accesorios-joyeria","aviso":"","tipos":["Plata","Cobre","Bronce","Acero"],"orden":10},
  {"clave":"piedras","nombre":"Piedras y minerales","padre":"accesorios-joyeria","aviso":"","tipos":["Lapislázuli","Piedras semipreciosas","Cuarzos"],"orden":20},
  {"clave":"bisuteria","nombre":"Bisutería","padre":"accesorios-joyeria","aviso":"","tipos":["Aros","Collares","Pulseras","Anillos"],"orden":30},
  {"clave":"accesorios-vestir","nombre":"Accesorios de vestir","padre":"accesorios-joyeria","aviso":"","tipos":["Gorros y bufandas","Cintillos","Pañuelos","Lentes"],"orden":40},
  {"clave":"bolsos","nombre":"Bolsos y mochilas","padre":"accesorios-joyeria","aviso":"","tipos":["Bolsos de tela","Mochilas","Estuches","Monederos"],"orden":50},
  {"clave":"deco-hogar","nombre":"Decoración y productos para el hogar","padre":"","aviso":"","tipos":[],"orden":40},
  {"clave":"textil-hogar","nombre":"Textil de hogar","padre":"deco-hogar","aviso":"","tipos":["Cojines","Mantas","Manteles","Cortinas"],"orden":10},
  {"clave":"velas-aromas","nombre":"Velas y aromas de hogar","padre":"deco-hogar","aviso":"","tipos":["Velas de soya","Velas decorativas","Difusores","Sahumerios"],"orden":20},
  {"clave":"iluminacion-objetos","nombre":"Iluminación y objetos","padre":"deco-hogar","aviso":"","tipos":["Lámparas","Espejos","Portarretratos"],"orden":30},
  {"clave":"organizacion","nombre":"Organización y almacenaje","padre":"deco-hogar","aviso":"","tipos":["Canastos","Cajas","Percheros"],"orden":40},
  {"clave":"vajilla-cocina","nombre":"Vajilla y cocina","padre":"deco-hogar","aviso":"","tipos":["Vajilla","Utensilios","Individuales"],"orden":50},
  {"clave":"papeleria-diseno","nombre":"Papelería, ilustración y diseño","padre":"","aviso":"","tipos":[],"orden":50},
  {"clave":"papeleria","nombre":"Papelería","padre":"papeleria-diseno","aviso":"","tipos":["Libretas","Agendas","Tarjetas","Planificadores"],"orden":10},
  {"clave":"ilustracion","nombre":"Ilustración y láminas","padre":"papeleria-diseno","aviso":"","tipos":["Láminas","Stickers","Postales"],"orden":20},
  {"clave":"serigrafia","nombre":"Serigrafía y estampado","padre":"papeleria-diseno","aviso":"","tipos":["Poleras","Bolsas","Afiches"],"orden":30},
  {"clave":"diseno-personalizado","nombre":"Diseño personalizado","padre":"papeleria-diseno","aviso":"","tipos":["Invitaciones","Etiquetas","Identidad de marca"],"orden":40},
  {"clave":"belleza-cuidado","nombre":"Belleza y cuidado personal","padre":"","aviso":"","tipos":[],"orden":60},
  {"clave":"cosmetica-natural","nombre":"Cosmética natural","padre":"belleza-cuidado","aviso":"Los productos cosméticos pueden requerir registro sanitario del ISP.","tipos":["Cremas","Aceites","Bálsamos labiales","Serums"],"orden":10},
  {"clave":"jabones-bano","nombre":"Jabones y baño","padre":"belleza-cuidado","aviso":"","tipos":["Jabón artesanal","Sales de baño","Exfoliantes","Bombas de baño"],"orden":20},
  {"clave":"capilar","nombre":"Cuidado capilar","padre":"belleza-cuidado","aviso":"","tipos":["Champú sólido","Aceites capilares","Acondicionadores"],"orden":30},
  {"clave":"maquillaje","nombre":"Maquillaje","padre":"belleza-cuidado","aviso":"","tipos":["Labiales","Sombras","Brochas"],"orden":40},
  {"clave":"perfumeria","nombre":"Perfumería y aromaterapia","padre":"belleza-cuidado","aviso":"","tipos":["Perfumes","Aceites esenciales","Sahumerios"],"orden":50},
  {"clave":"alimentos-bebidas","nombre":"Alimentos y bebidas","padre":"","aviso":"Vender comida preparada exige resolución sanitaria vigente.","tipos":[],"orden":70},
  {"clave":"pasteleria","nombre":"Pastelería y repostería","padre":"alimentos-bebidas","aviso":"","tipos":["Tortas","Galletas","Kuchen","Postres individuales","Sin azúcar o sin gluten"],"orden":10},
  {"clave":"panaderia","nombre":"Panadería","padre":"alimentos-bebidas","aviso":"","tipos":["Pan artesanal","Masa madre","Pan sin gluten"],"orden":20},
  {"clave":"conservas","nombre":"Conservas, mermeladas y miel","padre":"alimentos-bebidas","aviso":"","tipos":["Mermeladas","Encurtidos","Salsas","Miel","Aceite de oliva"],"orden":30},
  {"clave":"comida-preparada","nombre":"Comida preparada","padre":"alimentos-bebidas","aviso":"","tipos":["Comida caliente","Sándwiches","Comida vegana","Repostería salada"],"orden":40},
  {"clave":"cafe-te","nombre":"Café, té e infusiones","padre":"alimentos-bebidas","aviso":"","tipos":["Café de grano","Café preparado","Hierbas e infusiones"],"orden":50},
  {"clave":"bebidas-alcoholicas","nombre":"Cerveza, vino y destilados","padre":"alimentos-bebidas","aviso":"La venta de alcohol requiere permiso municipal específico para el evento.","tipos":["Cerveza artesanal","Vino","Pisco y destilados","Licores de fruta"],"orden":60},
  {"clave":"snacks","nombre":"Snacks y frutos secos","padre":"alimentos-bebidas","aviso":"","tipos":["Frutos secos","Deshidratados","Barras"],"orden":70},
  {"clave":"plantas-naturales","nombre":"Plantas y productos naturales","padre":"","aviso":"","tipos":[],"orden":80},
  {"clave":"plantas","nombre":"Plantas","padre":"plantas-naturales","aviso":"","tipos":["Suculentas","Plantas de interior","Cactus","Plantines"],"orden":10},
  {"clave":"huerto","nombre":"Huerto y jardinería","padre":"plantas-naturales","aviso":"","tipos":["Semillas","Composteras","Herramientas","Sustratos"],"orden":20},
  {"clave":"hierbas","nombre":"Hierbas y productos naturales","padre":"plantas-naturales","aviso":"Los productos con uso medicinal declarado requieren autorización del ISP.","tipos":["Hierbas secas","Tinturas","Ungüentos"],"orden":30},
  {"clave":"flores","nombre":"Flores y arreglos","padre":"plantas-naturales","aviso":"","tipos":["Flores frescas","Flores secas","Coronas","Ramos"],"orden":40},
  {"clave":"mascotas","nombre":"Productos para mascotas","padre":"","aviso":"","tipos":[],"orden":90},
  {"clave":"alimento-mascotas","nombre":"Alimento y snacks","padre":"mascotas","aviso":"","tipos":["Snacks naturales","Alimento preparado","Galletas"],"orden":10},
  {"clave":"accesorios-mascotas","nombre":"Accesorios","padre":"mascotas","aviso":"","tipos":["Camas","Collares y correas","Juguetes","Ropa"],"orden":20},
  {"clave":"cuidado-mascotas","nombre":"Cuidado e higiene","padre":"mascotas","aviso":"","tipos":["Shampoo","Cepillos","Colonias"],"orden":30},
  {"clave":"arte-fotografia","nombre":"Arte y fotografía","padre":"","aviso":"","tipos":[],"orden":100},
  {"clave":"pintura","nombre":"Pintura y dibujo","padre":"arte-fotografia","aviso":"","tipos":["Óleo","Acuarela","Acrílico","Dibujo"],"orden":10},
  {"clave":"fotografia","nombre":"Fotografía","padre":"arte-fotografia","aviso":"","tipos":["Fotografía impresa","Fotolibros","Postales"],"orden":20},
  {"clave":"escultura","nombre":"Escultura y objeto","padre":"arte-fotografia","aviso":"","tipos":["Escultura","Objeto de autor"],"orden":30},
  {"clave":"grabado","nombre":"Grabado y técnicas mixtas","padre":"arte-fotografia","aviso":"","tipos":["Grabado","Linograbado","Collage"],"orden":40},
  {"clave":"servicios-eventos","nombre":"Servicios para eventos","padre":"","aviso":"","tipos":[],"orden":110},
  {"clave":"talleres","nombre":"Talleres y experiencias","padre":"servicios-eventos","aviso":"","tipos":["Taller para niños","Taller para adultos","Demostración en vivo"],"orden":10},
  {"clave":"fotografia-eventos","nombre":"Fotografía de eventos","padre":"servicios-eventos","aviso":"","tipos":["Cobertura","Fotos instantáneas"],"orden":20},
  {"clave":"animacion","nombre":"Animación y música","padre":"servicios-eventos","aviso":"","tipos":["Música en vivo","Animación infantil","Caricaturas en vivo"],"orden":30},
  {"clave":"bienestar","nombre":"Bienestar y terapias","padre":"servicios-eventos","aviso":"","tipos":["Masaje","Terapias complementarias"],"orden":40},
  {"clave":"produccion","nombre":"Producción y montaje","padre":"servicios-eventos","aviso":"","tipos":["Arriendo de mobiliario","Decoración de eventos"],"orden":50},
  {"clave":"otro","nombre":"Otros productos o servicios","padre":"","aviso":"Al elegir este rubro, una persona del equipo revisa tu caso para clasificarlo.","tipos":[],"orden":120}
  ];

  SEMILLA.forEach(function (f) {
    var r = new Record(cat);
    r.set('clave', f.clave);
    r.set('nombre', f.nombre);
    r.set('padre', f.padre);
    r.set('aviso', f.aviso);
    r.set('tipos', f.tipos);
    r.set('orden', f.orden);
    r.set('activo', true);
    app.save(r);
  });

  /* ---------- 2 y 3. campos nuevos de la ficha ----------
     Se agregan con guarda, como el resto de las migraciones del
     proyecto: asi correrla dos veces no rompe nada. */
  var fichas = app.findCollectionByNameOrId('fichas');

  var NUEVOS_FICHA = [
    { name: 'cla_que_vende', type: 'text', max: 400 },
    { name: 'etiquetas', type: 'json', maxSize: 2000 },
    { name: 'productos_top', type: 'json', maxSize: 600 },
    { name: 'emp_web', type: 'url' },
    /* El logo queda publico igual que las fotos de producto: es material
       comercial, se muestra en el panel y en el documento que va a la
       productora, y protegerlo obligaria a pedir un permiso por cada
       miniatura sin ganar nada. */
    { name: 'logo', type: 'file', maxSelect: 1, maxSize: 5242880,
      mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
    { name: 'aviso_estado', type: 'text', max: 20 }
  ];
  NUEVOS_FICHA.forEach(function (f) {
    if (!fichas.fields.getByName(f.name)) fichas.fields.add(new Field(f));
  });
  app.save(fichas);

  /* ---------- 4. datos de transferencia ---------- */
  var op = app.findCollectionByNameOrId('oportunidades');
  if (!op.fields.getByName('datos_transferencia')) {
    op.fields.add(new Field({ name: 'datos_transferencia', type: 'text', max: 600 }));
    app.save(op);
  }

  /* ---------- 6. de que estado ya se avisó ---------- */
  var post = app.findCollectionByNameOrId('postulaciones');
  if (!post.fields.getByName('aviso_estado')) {
    post.fields.add(new Field({ name: 'aviso_estado', type: 'text', max: 20 }));
    app.save(post);
  }

  /* Las filas que ya existen no deben gatillar un correo retroactivo:
     se marcan como ya avisadas de su estado actual. */
  app.db().newQuery("UPDATE fichas SET aviso_estado = estado").execute();
  app.db().newQuery("UPDATE postulaciones SET aviso_estado = estado").execute();

  /* ---------- 5. plantillas de correo ----------
     En la base y no en el codigo porque el cliente pidio poder cambiar
     los textos despues sin depender de un despliegue. Solo el equipo las
     ve: no hay lectura publica. */
  var pl = new Collection({
    type: 'base',
    name: 'plantillas_correo',
    fields: [
      { name: 'clave', type: 'text', required: true, max: 40 },
      { name: 'asunto', type: 'text', required: true, max: 200 },
      { name: 'cuerpo', type: 'text', required: true, max: 4000 },
      { name: 'activa', type: 'bool' }
    ],
    indexes: ['CREATE UNIQUE INDEX idx_plantillas_clave ON plantillas_correo (clave)'],
    listRule: '@request.auth.rol = "admin"',
    viewRule: '@request.auth.rol = "admin"',
    createRule: '@request.auth.rol = "admin"',
    updateRule: '@request.auth.rol = "admin"',
    deleteRule: '@request.auth.rol = "admin"'
  });
  app.save(pl);

  /* Textos de partida. El cliente dijo que manda los definitivos, y esto
     existe para que el dia que los mande no haya que tocar codigo. Las
     marcas entre llaves las reemplaza el hook. */
  var PLANTILLAS = [
    {
      clave: 'ficha_validada',
      asunto: 'Tu ficha de {emprendimiento} quedó validada',
      cuerpo: 'Hola {nombre},\n\n' +
        'Revisamos la ficha de {emprendimiento} y quedó validada. Ya puedes ' +
        'postular a cualquier oportunidad publicada en {sitio}.\n\n' +
        'La clasificamos como {rubro}. Si crees que no corresponde, respóndenos ' +
        'este correo y lo revisamos.\n\n' +
        'Equipo de EquipoUni'
    },
    {
      clave: 'ficha_correccion',
      asunto: 'Hay algo que corregir en la ficha de {emprendimiento}',
      cuerpo: 'Hola {nombre},\n\n' +
        'Revisamos la ficha de {emprendimiento} y necesitamos que corrijas ' +
        'esto:\n\n{observaciones}\n\n' +
        'Puedes editarla en {sitio}. Cuando la guardes vuelve a la cola de ' +
        'revisión y te avisamos de nuevo.\n\n' +
        'Equipo de EquipoUni'
    },
    {
      clave: 'seleccionado',
      asunto: 'Quedaste seleccionado en {oportunidad}',
      cuerpo: 'Hola {nombre},\n\n' +
        '{emprendimiento} quedó seleccionado para {oportunidad}.\n\n' +
        'Para confirmar tu cupo tienes que pagar la participación:\n\n' +
        '{transferencia}\n\n' +
        'Cuando transfieras, mándanos el comprobante respondiendo este correo. ' +
        'Tu cupo queda confirmado cuando lo recibimos.\n\n' +
        'Equipo de EquipoUni'
    }
  ];

  PLANTILLAS.forEach(function (p) {
    var r = new Record(pl);
    r.set('clave', p.clave);
    r.set('asunto', p.asunto);
    r.set('cuerpo', p.cuerpo);
    r.set('activa', true);
    app.save(r);
  });

}, function (app) {

  ['catalogo', 'plantillas_correo'].forEach(function (n) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (e) { /* ya no está */ }
  });

  function quitar(coleccion, nombres) {
    var c = app.findCollectionByNameOrId(coleccion);
    nombres.forEach(function (n) {
      if (c.fields.getByName(n)) c.fields.removeByName(n);
    });
    app.save(c);
  }

  quitar('fichas', ['cla_que_vende', 'etiquetas', 'productos_top',
                    'emp_web', 'logo', 'aviso_estado']);
  quitar('oportunidades', ['datos_transferencia']);
  quitar('postulaciones', ['aviso_estado']);
});
