document.addEventListener('DOMContentLoaded', () => {
  // Elementos UI
  const loginForm = document.getElementById('login-supervisor');
  const supervisorUI = document.getElementById('supervisor-interface');
  const btnLogin = document.getElementById('btn-login-supervisor');
  const btnLogout = document.getElementById('btn-logout-supervisor');
  const btnBorrarHistorial = document.getElementById('btn-borrar-historial');
  
  // Variables de estado
  let mapaSupervisor = null;
  let capaSectores = null;

  // Función para configurar la escucha del historial
  function configurarEscuchaHistorial() {
    return db.collection('historial')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot((snapshot) => {
        const tbody = document.getElementById('body-historial');
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
          tbody.innerHTML = `
            <tr>
              <td colspan="4" class="text-center py-4 text-muted">
                <i class="fas fa-inbox fa-2x mb-2"></i>
                <p>No hay registros en el historial</p>
              </td>
            </tr>
          `;
          return;
        }

        snapshot.forEach(doc => {
          const data = doc.data();
          const fecha = data.timestamp?.toDate() || new Date();
          
          const fila = document.createElement('tr');
          fila.innerHTML = `
            <td>${data.sectorNombre || 'N/A'}</td>
            <td><span class="badge-estado badge-${data.nuevoEstado}">
              ${(data.nuevoEstado || '').replace('_', ' ')}
            </span></td>
            <td>${fecha.toLocaleString()}</td>
            <td>${data.usuarioEmail || 'Sistema'}</td>
          `;
          tbody.appendChild(fila);
        });
      }, (error) => {
        console.error("Error en listener de historial:", error);
        mostrarNotificacion('Error cargando historial', 'error');
      });
  }

  // Función para borrar el historial
  async function borrarHistorial() {
    if (!confirm('¿Estás seguro que deseas borrar todo el historial de cambios?\nEsta acción no se puede deshacer.')) {
      return;
    }

    const loadingNotification = mostrarNotificacion('Borrando historial...', 'info', 0);
    
    try {
      // Obtener todos los documentos del historial
      const snapshot = await db.collection('historial').get();
      
      if (snapshot.empty) {
        mostrarNotificacion('El historial ya está vacío', 'info');
        return;
      }

      // Usar batch para borrado masivo
      const batch = db.batch();
      let counter = 0;
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
        counter++;
      });
      
      await batch.commit();
      
      mostrarNotificacion(`Se borraron ${counter} registros del historial`, 'success');
    } catch (error) {
      console.error("Error borrando historial:", error);
      mostrarNotificacion(`Error al borrar historial: ${error.message}`, 'error');
    } finally {
      if (loadingNotification) loadingNotification.remove();
    }
  }

  // Iniciar sesión supervisor
  btnLogin.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('supervisor-email').value;
    const password = document.getElementById('supervisor-password').value;
    
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
    if (user && user.email.endsWith('@ecoruta.com')) {
      loginForm.classList.add('d-none');
      supervisorUI.classList.remove('d-none');
      
      await iniciarMapaSupervisor();
      configurarEscuchaHistorial();
      
      // Configurar botón de borrado
      btnBorrarHistorial.addEventListener('click', borrarHistorial);
    } else {
      loginForm.classList.remove('d-none');
      supervisorUI.classList.add('d-none');
      if (mapaSupervisor) {
        mapaSupervisor.remove();
        mapaSupervisor = null;
        capaSectores = null;
      }
    }
  });

  // Inicializar mapa
  async function iniciarMapaSupervisor() {
    if (mapaSupervisor) return;
    
    mapaSupervisor = cargarMapaBase('mapa-supervisor');
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
        
        layer.bindPopup(`
          <b>${feature.properties.nombre}</b><br>
          Estado: <span class="badge ${obtenerClaseBadgePorEstado(feature.properties.estado)}">
            ${feature.properties.estado.replace('_', ' ').toUpperCase()}
          </span>
        `);
      }
    }).addTo(mapaSupervisor);
    
    mapaSupervisor.fitBounds(capaSectores.getBounds());
  }

  // Función para mostrar notificación persistente
  function mostrarNotificacion(mensaje, tipo = 'info', duracion = 5000) {
    const tipos = {
      success: { class: 'alert-success', icon: 'check-circle' },
      error: { class: 'alert-danger', icon: 'exclamation-triangle' },
      info: { class: 'alert-info', icon: 'info-circle' }
    };
    
    const notificacion = document.createElement('div');
    notificacion.className = `alert ${tipos[tipo].class} alert-dismissible fade show position-fixed`;
    notificacion.style.cssText = `
      top: 20px;
      right: 20px;
      z-index: 2000;
      min-width: 300px;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
    `;
    notificacion.innerHTML = `
      <i class="fas fa-${tipos[tipo].icon} me-2"></i>
      ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const existente = document.querySelector('.alert.position-fixed');
    if (existente) existente.remove();
    
    document.body.appendChild(notificacion);

    if (duracion > 0) {
      setTimeout(() => {
        notificacion.classList.add('fade');
        setTimeout(() => notificacion.remove(), 150);
      }, duracion);
    }

    return notificacion;
  }
});