document.addEventListener('DOMContentLoaded', () => {
  // Elementos UI
  const loginForm = document.getElementById('login-supervisor');
  const supervisorUI = document.getElementById('supervisor-interface');
  const btnLogin = document.getElementById('btn-login-supervisor');
  const btnLogout = document.getElementById('btn-logout-supervisor');
  const btnBorrarHistorial = document.getElementById('btn-borrar-historial');
  const btnBorrarNotificaciones = document.getElementById('btn-borrar-notificaciones');
  const btnActualizarNotificaciones = document.getElementById('btn-actualizar-notificaciones');
  const selectAllNotificaciones = document.getElementById('select-all-notificaciones');
  
  // Variables de estado
  let mapaSupervisor = null;
  let capaSectores = null;
  let listenerNotificaciones = null;
  let notificacionesSeleccionadas = new Set();

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

  // Función para borrar notificaciones seleccionadas
  async function borrarNotificacionesSeleccionadas() {
    if (notificacionesSeleccionadas.size === 0) {
      mostrarNotificacion('Selecciona al menos una notificación para eliminar', 'warning');
      return;
    }

    if (!confirm(`¿Estás seguro que deseas eliminar ${notificacionesSeleccionadas.size} notificación(es)?\nEsta acción no se puede deshacer.`)) {
      return;
    }

    const loadingNotification = mostrarNotificacion('Eliminando notificaciones...', 'info', 0);
    
    try {
      // Usar batch para borrado masivo
      const batch = db.batch();
      
      notificacionesSeleccionadas.forEach(notificacionId => {
        const notificacionRef = db.collection('notificaciones').doc(notificacionId);
        batch.delete(notificacionRef);
      });
      
      await batch.commit();
      
      mostrarNotificacion(`Se eliminaron ${notificacionesSeleccionadas.size} notificación(es)`, 'success');
      notificacionesSeleccionadas.clear();
      actualizarContadorSeleccionados();
      
    } catch (error) {
      console.error("Error borrando notificaciones:", error);
      mostrarNotificacion(`Error al borrar notificaciones: ${error.message}`, 'error');
    } finally {
      if (loadingNotification) loadingNotification.remove();
    }
  }

  // Función para actualizar contador de seleccionados
  function actualizarContadorSeleccionados() {
    const contador = document.getElementById('contador-seleccionados');
    contador.textContent = `${notificacionesSeleccionadas.size} seleccionados`;
    
    // Actualizar estado del checkbox "Seleccionar todos"
    const checkboxes = document.querySelectorAll('.notificacion-checkbox:checked');
    selectAllNotificaciones.checked = checkboxes.length > 0 && checkboxes.length === document.querySelectorAll('.notificacion-checkbox').length;
  }

  // Función para seleccionar/deseleccionar todas las notificaciones
  function toggleSeleccionarTodasNotificaciones() {
    const checkboxes = document.querySelectorAll('.notificacion-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAllNotificaciones.checked;
      const notificacionId = checkbox.dataset.id;
      
      if (selectAllNotificaciones.checked) {
        notificacionesSeleccionadas.add(notificacionId);
      } else {
        notificacionesSeleccionadas.delete(notificacionId);
      }
    });
    
    actualizarContadorSeleccionados();
  }

  // Función para configurar escucha de notificaciones
  function configurarEscuchaNotificaciones() {
    if (listenerNotificaciones) {
      listenerNotificaciones(); // Remover listener anterior
    }
    
    return db.collection('notificaciones')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .onSnapshot((snapshot) => {
        const tbody = document.getElementById('body-notificaciones');
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" class="text-center py-4 text-muted">
                <i class="fas fa-bell-slash fa-2x mb-2"></i>
                <p>No hay notificaciones</p>
              </td>
            </tr>
          `;
          return;
        }

        snapshot.forEach(doc => {
          const data = doc.data();
          const fecha = data.timestamp?.toDate() || new Date();
          const notificacionId = doc.id;
          const isSelected = notificacionesSeleccionadas.has(notificacionId);
          
          const fila = document.createElement('tr');
          fila.innerHTML = `
            <td>
              <input type="checkbox" class="form-check-input notificacion-checkbox" 
                     data-id="${notificacionId}" ${isSelected ? 'checked' : ''}>
            </td>
            <td>${fecha.toLocaleString()}</td>
            <td>${data.conductorEmail || 'N/A'}</td>
            <td><span class="badge bg-warning">${data.tipo || 'N/A'}</span></td>
            <td>${data.mensaje || 'N/A'}</td>
            <td>${data.sectorId || 'Todos'}</td>
            <td>
              <button class="btn btn-sm btn-outline-danger btn-eliminar-notificacion" 
                      data-id="${notificacionId}" title="Eliminar notificación">
                <i class="fas fa-trash-alt"></i>
              </button>
            </td>
          `;
          tbody.appendChild(fila);
        });

        // Agregar event listeners a los checkboxes
        document.querySelectorAll('.notificacion-checkbox').forEach(checkbox => {
          checkbox.addEventListener('change', (e) => {
            const notificacionId = e.target.dataset.id;
            
            if (e.target.checked) {
              notificacionesSeleccionadas.add(notificacionId);
            } else {
              notificacionesSeleccionadas.delete(notificacionId);
            }
            
            actualizarContadorSeleccionados();
          });
        });

        // Agregar event listeners a los botones de eliminar individual
        document.querySelectorAll('.btn-eliminar-notificacion').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const notificacionId = e.target.closest('.btn-eliminar-notificacion').dataset.id;
            
            if (!confirm('¿Estás seguro que deseas eliminar esta notificación?\nEsta acción no se puede deshacer.')) {
              return;
            }

            try {
              await db.collection('notificaciones').doc(notificacionId).delete();
              mostrarNotificacion('Notificación eliminada correctamente', 'success');
              
              // Remover de seleccionados si estaba seleccionada
              notificacionesSeleccionadas.delete(notificacionId);
              actualizarContadorSeleccionados();
              
            } catch (error) {
              console.error("Error eliminando notificación:", error);
              mostrarNotificacion('Error al eliminar la notificación', 'error');
            }
          });
        });
      }, (error) => {
        console.error("Error en listener de notificaciones:", error);
      });
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
      listenerNotificaciones = configurarEscuchaNotificaciones();
      
      // Configurar botones
      btnBorrarHistorial.addEventListener('click', borrarHistorial);
      btnBorrarNotificaciones.addEventListener('click', borrarNotificacionesSeleccionadas);
      btnActualizarNotificaciones.addEventListener('click', () => {
        if (listenerNotificaciones) {
          listenerNotificaciones();
          mostrarNotificacion('Notificaciones actualizadas', 'info');
        }
      });
      selectAllNotificaciones.addEventListener('change', toggleSeleccionarTodasNotificaciones);

    } else {
      loginForm.classList.remove('d-none');
      supervisorUI.classList.add('d-none');
      if (mapaSupervisor) {
        mapaSupervisor.remove();
        mapaSupervisor = null;
        capaSectores = null;
      }
      // Limpiar listeners
      if (listenerNotificaciones) {
        listenerNotificaciones();
        listenerNotificaciones = null;
      }
      // Limpiar selecciones
      notificacionesSeleccionadas.clear();
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
