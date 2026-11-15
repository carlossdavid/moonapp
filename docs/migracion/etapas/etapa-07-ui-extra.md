# Etapa 7 — UI extra (minimap, video, menús)

## Objetivo
Completar interfaces: minimapa, video de intro, ajustes de menús y modales.

## Tareas
1. **Video intro**
   - Convertir `assets/video/intro.mp4` a `.ogv` (Theora) o usar formato compatible con Godot (según plataforma). Colocar en `res://assets/video/intro.ogv`.
   - Escena `scenes/ui/VideoIntro.tscn`: `VideoStreamPlayer` a pantalla completa. Reproducir al pulsar “Iniciar” en menú; al terminar (`finished`) cambiar a `InteriorBase.tscn` (o escena inicial del juego). Permitir saltar con `ui_cancel` o `interact` (Space/Enter).
   - Alternativa rápida: omitir video y ir directo al juego.

2. **Minimap**
   - Opción A: `SubViewport` que renderiza una versión simplificada del nivel + icono jugador, mostrado en un `TextureRect` (esquina superior derecha).
   - Opción B: dibujar con `_draw()` en un `Control` (rectángulos/puntos) — más simple, menos fiel.
   - Toggle con `toggle_map` (M). Mostrar marcador de salida/base si aplica.

3. **Menú principal**
   - Botones: Iniciar, Configuraciones (placeholder modal). Estilo coherente (fuente Press Start 2P, fondos del proyecto).
   - Transiciones: fade simple con `Tween` o `AnimationPlayer` (opcional).

4. **Modales**
   - `ComingSoonModal.tscn`: reutilizable (título, descripción, botón). Mostrar/ocultar desde cualquier escena vía señal o método en autoload/manager.

## Criterios de aceptación
- [ ] Video se reproduce y salta correctamente (si se implementa).
- [ ] Minimap visible/oculto con M y refleja posición aproximada del jugador.
- [ ] Menú funcional y con estética básica del proyecto.

## Notas
- En export HTML5, `VideoStreamPlayer` puede tener limitaciones; probar temprano.