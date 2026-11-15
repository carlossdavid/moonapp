extends CharacterBody2D
class_name Player

## Movimiento (ajusta estos valores según config.js del proyecto JS)
@export var max_speed: float = 80.0          # px/s (equivalente a MOVE_MAX_SPEED)
@export var acceleration: float = 600.0      # px/s^2 (MOVE_ACCEL)
@export var friction: float = 500.0          # px/s^2 (MOVE_FRICTION)
@export var acceleration_air: float = 600.0  # opcional si luego hay aire; aquí igual

@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

var _facing: String = "down"  # down, up, left, right


func _physics_process(delta: float) -> void:
	# Entrada en ejes (-1..1)
	var input_dir := Vector2(
		Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
		Input.get_action_strength("move_down") - Input.get_action_strength("move_up")
	)

	if input_dir.length_squared() > 1.0:
		input_dir = input_dir.normalized()

	var target_velocity := input_dir * max_speed

	if input_dir != Vector2.ZERO:
		# Acelerar hacia la velocidad objetivo
		velocity = velocity.move_toward(target_velocity, acceleration * delta)
		_update_facing(input_dir)
	else:
		# Frenar (fricción)
		velocity = velocity.move_toward(Vector2.ZERO, friction * delta)

	move_and_slide()
	_update_animation(input_dir)


func _update_facing(dir: Vector2) -> void:
	# Prioridad simple: horizontal si |x| >= |y|, si no vertical
	if absf(dir.x) >= absf(dir.y):
		_facing = "right" if dir.x > 0.0 else "left"
	else:
		_facing = "down" if dir.y > 0.0 else "up"


func _update_animation(dir: Vector2) -> void:
	if sprite == null or not (sprite is AnimatedSprite2D):
		return
	var is_moving := dir.length_squared() > 0.0001
	var anim_name := ("walk_" if is_moving else "idle_") + _facing
	# Evita reiniciar animación si ya está sonando la misma
	if sprite.sprite_frames and sprite.sprite_frames.has_animation(anim_name):
		if sprite.animation != anim_name:
			sprite.play(anim_name)
		elif not sprite.is_playing() and is_moving:
			sprite.play(anim_name)
	# Si no existe la animación, no hace nada (evita errores)
