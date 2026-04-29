from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class Stock(Base):
    """
    A stock receipt — represents one supplier order placed by an admin.
    Each row tracks: when it was ordered, when it arrived, the cost
    of the goods and the shipping fee, and the total quantity received.

    Scoped per admin user (admin_user_id). super_admin sees them all.
    """
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Reference / label provided by the admin (purchase order number,
    # supplier name, …). Optional but handy.
    reference = Column(String(120), nullable=True)

    order_date = Column(Date, nullable=False)               # date de la commande
    arrival_date = Column(Date, nullable=True)              # date d'arrivée (peut être NULL en attendant)

    total_amount = Column(Numeric(12, 2), nullable=False, default=0)   # montant total du stock
    shipping_amount = Column(Numeric(12, 2), nullable=False, default=0) # frais de livraison
    quantity = Column(Integer, nullable=False, default=0)              # quantité de produit

    currency = Column(String(8), nullable=False, default="HTG")
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    admin = relationship("User", lazy="joined")
