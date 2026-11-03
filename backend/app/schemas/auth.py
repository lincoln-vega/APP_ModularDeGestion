from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    # None para admin: no está atado a un negocio puntual.
    negocio_id: int | None
    nombre: str
    usuario_id: int
