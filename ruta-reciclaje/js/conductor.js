document.addEventListener('DOMContentLoaded', () => {
  // Elementos UI
  const loginForm = document.getElementById('login-conductor');
  const conductorUI = document.getElementById('conductor-interface');
  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const infoSector = document.getElementById('info-sector');
  const controlesEdicion = document.getElementById('controles-edicion');
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const btnAbrirNotificacion = document.getElementById('btnAbrirNotificacion');

  // Variables de estado
  let mapaConductor = null;
  let sectorSeleccionado = null;
  let capaSectores = null;
  let sectoresDisponibles = [];
  const layers = {};

  // Toggle para mostrar/ocultar contraseña
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePassword.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
  }

  // Iniciar sesión
  btnLogin.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      mostrarNotificacion(`Error: ${error.message}`, 'error');
    }
  });

  // Cerrar sesión
  btnLogout.addEventListener('click', () => {
    auth.signOut();
  });

  // Estado de autenticación
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      loginForm.classList.add('d-none');
      conductorUI.classList.remove('d-none');
      
      // Mostrar botón de notificaciones solo cuando el conductor está autenticado
      if (btnAbrirNotificacion) {
        btnAbrirNotificacion.style.display = 'block';
      }
      
      await iniciarMapaConductor();
      escucharCambiosEnTiempoReal();
      actualizarResumen();
      
      // Mostrar nombre de usuario
      document.getElementById('userName').textContent = user.email.split('@')[0];
    } else {
      loginForm.classList.remove('d-none');
      conductorUI.classList.add('d-none');
      
      // Ocultar botón de notificaciones cuando no hay usuario autenticado
      if (btnAbrirNotificacion) {
        btnAbrirNotificacion.style.display = 'none';
      }
      
      if (mapaConductor) {
        mapaConductor.remove();
        mapaConductor = null;
        capaSectores = null;
        sectorSeleccionado = null;
        Object.keys(layers).forEach(key => delete layers[key]);
      }
    }
  });

  // Inicializar mapa
  async function iniciarMapaConductor() {
    if (mapaConductor) return;
    
    mapaConductor = cargarMapaBase('mapa-conductor');
    const geojsonData = await cargarDatosSectores();
    
    if (!geojsonData) {
      mostrarNotificacion('Error cargando los sectores', 'error');
      return;
    }
    
    // Capa de sectores
    capaSectores = L.geoJSON(geojsonData, {
      style: (feature) => getEstiloSector(feature.properties.estado),
      onEachFeature: (feature, layer) => {
        const sectorId = feature.properties.id;
        layers[sectorId] = layer;
        layer._leaflet_id = sectorId;
        
        layer.on('click', () => {
          seleccionarSector(sectorId, feature.properties);
        });
        
        layer.feature = feature;
      }
    }).addTo(mapaConductor);
    
    mapaConductor.fitBounds(capaSectores.getBounds());
  }

  // Seleccionar sector
  function seleccionarSector(sectorId, propiedades) {
    // Deseleccionar anterior
    if (sectorSeleccionado && layers[sectorSeleccionado.id]) {
      layers[sectorSeleccionado.id].setStyle(getEstiloSector(sectorSeleccionado.estado));
    }
    
    // Seleccionar nuevo
    sectorSeleccionado = { id: sectorId, ...propiedades };
    layers[sectorId].setStyle({
      weight: 3,
      color: '#000'
    });
    
    mostrarInfoSector(propiedades);
    mostrarControlesEdicion();
  }

  // Mostrar información del sector
  function mostrarInfoSector(sector) {
    infoSector.innerHTML = `
      <h4>${sector.nombre}</h4>
      <p><strong>Estado actual:</strong> 
        <span class="badge ${obtenerClaseBadgePorEstado(sector.estado)}">
          ${sector.estado.replace('_', ' ').toUpperCase()}
        </span>
      </p>
      <hr>
      <p><small>ID: ${sector.id}</small></p>
    `;
  }

  // Mostrar controles de edición
  function mostrarControlesEdicion() {
    if (!sectorSeleccionado) return;
    
    controlesEdicion.innerHTML = `
      <div class="card">
        <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Cambiar Estado</h5>
          <button class="btn-close btn-close-white" id="btn-cerrar-controles"></button>
        </div>
        <div class="card-body">
          <div class="d-grid gap-2">
            <button class="btn btn-success" id="btn-marcar-recolectado">
              <i class="fas fa-check-circle"></i> Recolectado
            </button>
            <button class="btn btn-warning" id="btn-marcar-camino">
              <i class="fas fa-truck-moving"></i> En Camino
            </button>
            <button class="btn btn-danger" id="btn-marcar-pendiente">
              <i class="fas fa-clock"></i> Pendiente
            </button>
          </div>
        </div>
      </div>
    `;
      
    document.getElementById('btn-cerrar-controles').addEventListener('click', () => {
      controlesEdicion.innerHTML = '';
      if (sectorSeleccionado && layers[sectorSeleccionado.id]) {
        layers[sectorSeleccionado.id].setStyle(getEstiloSector(sectorSeleccionado.estado));
      }
      sectorSeleccionado = null;
    });
    
    document.getElementById('btn-marcar-recolectado').addEventListener('click', async () => {
      if (!sectorSeleccionado) return;
      
      const exito = await actualizarEstadoSector(sectorSeleccionado.id, 'recolectado');
      if (exito) {
        sectorSeleccionado.estado = 'recolectado';
        mostrarInfoSector(sectorSeleccionado);
        actualizarResumen();
        mostrarNotificacion(`Sector ${sectorSeleccionado.nombre} marcado como recolectado`, 'success');
      }
    });
    
    document.getElementById('btn-marcar-camino').addEventListener('click', async () => {
      if (!sectorSeleccionado) return;
      
      const exito = await actualizarEstadoSector(sectorSeleccionado.id, 'en_camino');
      if (exito) {
        sectorSeleccionado.estado = 'en_camino';
        mostrarInfoSector(sectorSeleccionado);
        actualizarResumen();
        mostrarNotificacion(`Sector ${sectorSeleccionado.nombre} marcado como en camino`, 'success');
      }
    });
    
    document.getElementById('btn-marcar-pendiente').addEventListener('click', async () => {
      if (!sectorSeleccionado) return;
      
      const exito = await actualizarEstadoSector(sectorSeleccionado.id, 'pendiente');
      if (exito) {
        sectorSeleccionado.estado = 'pendiente';
        mostrarInfoSector(sectorSeleccionado);
        actualizarResumen();
        mostrarNotificacion(`Sector ${sectorSeleccionado.nombre} marcado como pendiente`, 'success');
      }
    });
  }

  // Escuchar cambios en tiempo real
  function escucharCambiosEnTiempoReal() {
    db.collection('sectores').onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const sectorId = change.doc.id;
          const nuevoEstado = change.doc.data().estado;
          
          // Actualizar capa si existe
          if (layers[sectorId]) {
            layers[sectorId].setStyle(getEstiloSector(nuevoEstado));
            
            // Actualizar si está seleccionado
            if (sectorSeleccionado && sectorSeleccionado.id === sectorId) {
              sectorSeleccionado.estado = nuevoEstado;
              mostrarInfoSector(sectorSeleccionado);
            }
          }
        }
      });
      actualizarResumen();
    }, (error) => {
      console.error("Error en listener:", error);
    });
  }

  // Actualizar resumen de estados
  async function actualizarResumen() {
    try {
      const snapshot = await db.collection('sectores').get();
      const conteo = {
        pendiente: 0,
        en_camino: 0,
        recolectado: 0
      };
      
      snapshot.forEach(doc => {
        const estado = doc.data().estado;
        if (conteo.hasOwnProperty(estado)) {
          conteo[estado]++;
        }
      });

      const total = conteo.pendiente + conteo.en_camino + conteo.recolectado;
      
      // Actualizar contadores
      document.getElementById('contador-pendientes-conductor').textContent = conteo.pendiente;
      document.getElementById('contador-camino-conductor').textContent = conteo.en_camino;
      document.getElementById('contador-recolectados-conductor').textContent = conteo.recolectado;
      
      // Actualizar barra de progreso
      if (total > 0) {
        document.getElementById('progress-pendiente-conductor').style.width = `${(conteo.pendiente / total) * 100}%`;
        document.getElementById('progress-camino-conductor').style.width = `${(conteo.en_camino / total) * 100}%`;
        document.getElementById('progress-completado-conductor').style.width = `${(conteo.recolectado / total) * 100}%`;
      }
      
    } catch (error) {
      console.error("Error actualizando resumen:", error);
    }
  }

  // Event listeners para acciones rápidas
  document.getElementById('btn-reportar-problema')?.addEventListener('click', async () => {
    if (sectorSeleccionado) {
      const exito = await actualizarEstadoSector(sectorSeleccionado.id, 'pendiente');
      if (exito) {
        sectorSeleccionado.estado = 'pendiente';
        mostrarInfoSector(sectorSeleccionado);
        actualizarResumen();
        mostrarNotificacion(`Sector ${sectorSeleccionado.nombre} marcado como pendiente`, 'success');
      }
    } else {
      mostrarNotificacion('Por favor selecciona un sector primero', 'error');
    }
  });

  document.getElementById('btn-pausar-ruta')?.addEventListener('click', async () => {
    if (sectorSeleccionado) {
      const exito = await actualizarEstadoSector(sectorSeleccionado.id, 'en_camino');
      if (exito) {
        sectorSeleccionado.estado = 'en_camino';
        mostrarInfoSector(sectorSeleccionado);
        actualizarResumen();
        mostrarNotificacion(`Sector ${sectorSeleccionado.nombre} marcado como en camino`, 'success');
      }
    } else {
      mostrarNotificacion('Por favor selecciona un sector primero', 'error');
    }
  });

  document.getElementById('btn-finalizar-jornada')?.addEventListener('click', async () => {
    if (sectorSeleccionado) {
      const exito = await actualizarEstadoSector(sectorSeleccionado.id, 'recolectado');
      if (exito) {
        sectorSeleccionado.estado = 'recolectado';
        mostrarInfoSector(sectorSeleccionado);
        actualizarResumen();
        mostrarNotificacion(`Sector ${sectorSeleccionado.nombre} marcado como recolectado`, 'success');
      }
    } else {
      mostrarNotificacion('Por favor selecciona un sector primero', 'error');
    }
  });

  // Event listeners para notificaciones (solo si el botón existe)
  if (btnAbrirNotificacion) {
    btnAbrirNotificacion.addEventListener('click', abrirModalNotificacion);
  }
  
  if (document.getElementById('btnEnviarNotificacion')) {
    document.getElementById('btnEnviarNotificacion').addEventListener('click', enviarNotificacion);
  }

  // Función para abrir modal de notificación
  function abrirModalNotificacion() {
    // Verificar que el usuario esté autenticado
    const user = auth.currentUser;
    if (!user) {
      mostrarNotificacion('Debes estar autenticado para enviar notificaciones', 'error');
      return;
    }
    
    // Cargar sectores en el select
    cargarSectoresParaNotificacion();
    
    const modal = new bootstrap.Modal(document.getElementById('modalNotificacion'));
    modal.show();
  }

  // Función para cargar sectores
  async function cargarSectoresParaNotificacion() {
    try {
      const snapshot = await db.collection('sectores').get();
      const select = document.getElementById('sectorAfectado');
      
      // Limpiar opciones excepto la primera
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      snapshot.forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = doc.data().nombre;
        select.appendChild(option);
      });
      
      sectoresDisponibles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
    } catch (error) {
      console.error("Error cargando sectores:", error);
    }
  }

  // Función para enviar notificación
  async function enviarNotificacion() {
    const tipo = document.getElementById('tipoIncidencia').value;
    const sectorId = document.getElementById('sectorAfectado').value;
    const mensaje = document.getElementById('mensajeIncidencia').value;
    
    if (!tipo || !mensaje) {
      mostrarNotificacion('Por favor complete todos los campos obligatorios', 'error');
      return;
    }
    
    try {
      const sectorNombre = sectorId ? sectoresDisponibles.find(s => s.id === sectorId)?.nombre : 'Todos los sectores';
      
      const mensajeCompleto = `[${tipo.toUpperCase()}] ${mensaje} ${sectorId ? `(Sector: ${sectorNombre})` : ''}`;
      
      const exito = await window.firebaseFunctions.enviarNotificacion(tipo, mensajeCompleto, sectorId);
      
      if (exito) {
        mostrarNotificacion('Reporte enviado correctamente', 'success');
        document.getElementById('formNotificacion').reset();
        bootstrap.Modal.getInstance(document.getElementById('modalNotificacion')).hide();
      }
      
    } catch (error) {
      console.error("Error enviando notificación:", error);
      mostrarNotificacion('Error al enviar el reporte', 'error');
    }
  }
});

// Función auxiliar para obtener clase de badge según estado
function obtenerClaseBadgePorEstado(estado) {
  switch(estado) {
    case 'recolectado': return 'bg-success';
    case 'en_camino': return 'bg-warning';
    default: return 'bg-danger';
  }
}
