
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation
} from "react-router-dom";
import "./App.css";

const API = "http://localhost:5000/api";

const images = {
  hero: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1600&q=85",
  dosa: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80",
  biryani: "https://images.unsplash.com/photo-1563379091339-03246963d51a?auto=format&fit=crop&w=800&q=80",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
  fries: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80",
  default: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80"
};

function foodImage(food) {
  const name = (food.name || "").toLowerCase();
  if (name.includes("dosa")) return images.dosa;
  if (name.includes("biryani") || name.includes("biriyani")) return images.biryani;
  if (name.includes("pizza")) return images.pizza;
  if (name.includes("burger")) return images.burger;
  if (name.includes("fries")) return images.fries;
  return food.image || food.imageUrl || images.default;
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const [foods, setFoods] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [orders, setOrders] = useState([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [auth, setAuth] = useState({ name: "", email: "", password: "" });
  const [isRegister, setIsRegister] = useState(false);
  const [checkout, setCheckout] = useState({
    customerName: "", phone: "", address: "", paymentMethod: "Cash on Delivery"
  });
  const [newFood, setNewFood] = useState({
    name: "", price: "", image: "", description: ""
  });

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    window.scrollTo(0, 0);
    setNotice("");
  }, [location.pathname]);

  useEffect(() => {
    loadFoods();
  }, []);

  useEffect(() => {
    if (token && (location.pathname === "/orders" || (location.pathname === "/admin" && isAdmin))) {
      loadOrders();
    }
  }, [token, location.pathname, isAdmin]);

  async function loadFoods() {
    try {
      const response = await axios.get(`${API}/foods`);
      setFoods(Array.isArray(response.data) ? response.data : response.data.foods || []);
    } catch {
      setNotice("Could not load foods. Check that your backend and MongoDB are running.");
    }
  }

  async function loadOrders() {
    try {
      const response = await axios.get(
        `${API}${isAdmin ? "/orders" : "/orders/my"}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOrders(Array.isArray(response.data) ? response.data : response.data.orders || []);
    } catch (error) {
      setNotice(error.response?.data?.message || "Could not load orders.");
    }
  }

  function addToCart(food) {
    const id = food._id || food.id || food.name;
    setCart(current => {
      const found = current.find(item => item.id === id);
      if (found) {
        return current.map(item => item.id === id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, {
        id, foodId: food._id, name: food.name, price: Number(food.price),
        image: foodImage(food), quantity: 1
      }];
    });
    setNotice(`${food.name} added to cart!`);
  }

  function changeQuantity(id, amount) {
    setCart(current => current
      .map(item => item.id === id ? { ...item, quantity: item.quantity + amount } : item)
      .filter(item => item.quantity > 0)
    );
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setOrders([]);
    navigate("/");
    setNotice("You have logged out.");
  }

  async function submitAuth(event) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister ? auth : { email: auth.email, password: auth.password };
      const response = await axios.post(`${API}${endpoint}`, payload);
      const data = response.data;
      const savedToken = data.token || data.accessToken;
      const savedUser = data.user || data;

      if (!savedToken) {
        setNotice("No token returned by server. Check your auth API response.");
        return;
      }

      localStorage.setItem("token", savedToken);
      localStorage.setItem("user", JSON.stringify(savedUser));
      setToken(savedToken);
      setUser(savedUser);
      navigate("/");
      setNotice("Login successful!");
    } catch (error) {
      setNotice(error.response?.data?.message || "Login or registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (!token) {
      setNotice("Please log in before placing an order.");
      navigate("/login");
      return;
    }
    if (!cart.length) {
      setNotice("Your cart is empty.");
      navigate("/menu");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        items: cart.map(item => ({
          foodId: item.foodId,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        totalAmount: total,
        customerName: checkout.customerName,
        phone: checkout.phone,
        address: checkout.address
      };

      await axios.post(`${API}/orders`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCart([]);
      navigate("/orders");
      setNotice(
        checkout.paymentMethod === "Cash on Delivery"
          ? "Order placed! Payment is Cash on Delivery."
          : "Order saved. Online payment is demo-only and no money was charged."
      );
    } catch (error) {
      setNotice(error.response?.data?.message || "Order failed. Check the backend terminal.");
    } finally {
      setLoading(false);
    }
  }

  async function addFood(event) {
    event.preventDefault();
    try {
      await axios.post(`${API}/foods`, {
        name: newFood.name,
        price: Number(newFood.price),
        image: newFood.image,
        description: newFood.description
      }, { headers: { Authorization: `Bearer ${token}` } });

      setNewFood({ name: "", price: "", image: "", description: "" });
      setNotice("Food added successfully!");
      loadFoods();
    } catch (error) {
      setNotice(error.response?.data?.message || "Could not add food. Check admin access.");
    }
  }

  async function deleteFood(id) {
    if (!window.confirm("Delete this food item?")) return;
    try {
      await axios.delete(`${API}/foods/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotice("Food deleted.");
      loadFoods();
    } catch (error) {
      setNotice(error.response?.data?.message || "Could not delete food.");
    }
  }

  async function updateOrder(id, status) {
    try {
      await axios.patch(`${API}/orders/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotice("Order status updated.");
      loadOrders();
    } catch (error) {
      setNotice(error.response?.data?.message || "Could not update order status.");
    }
  }

  return (
    <>
      <header className="navbar">
        <Link to="/" className="brand">🍴 Delicious<span>Food</span></Link>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/menu">Menu</Link>
          <Link to="/cart">Cart <span className="cart-count">{cartCount}</span></Link>
          <Link to="/payment">Payment</Link>
          {user && <Link to="/orders">My Orders</Link>}
          {isAdmin && <Link to="/admin">Admin</Link>}
          {!user
            ? <Link to="/login">Login</Link>
            : <button className="logout-btn" onClick={logout}>Logout</button>}
        </nav>
      </header>

      {notice && (
        <div className="notice">
          <span>{notice}</span>
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <Routes>
        <Route path="/" element={
          <main>
            <section className="hero" style={{
              backgroundImage: `linear-gradient(90deg, rgba(20,15,10,.88), rgba(20,15,10,.18)), url("${images.hero}")`
            }}>
              <div className="hero-content">
                <p className="eyebrow">GOOD FOOD · GOOD MOOD</p>
                <h1>Delicious food,<br /><span>delivered with love.</span></h1>
                <p>Fresh flavours, favourite meals, and happiness in every bite.</p>
                <Link to="/menu" className="main-btn">Explore Our Menu →</Link>
              </div>
            </section>
          </main>
        } />

        <Route path="/menu" element={
          <main className="section page-section">
            <p className="eyebrow">FIND YOUR FAVOURITE</p>
            <h1>Our Menu</h1>
            <p className="muted">Good food for every craving.</p>
            <FoodGrid foods={foods} addToCart={addToCart} />
          </main>
        } />

        <Route path="/cart" element={
          <main className="section page-section">
            <h1>Your Shopping Cart</h1>
            {!cart.length ? <Empty text="Your cart is empty." link="/menu" label="Explore Menu" /> : (
              <div className="cart-layout">
                <div className="cart-list">
                  {cart.map(item => (
                    <div className="cart-row" key={item.id}>
                      <img src={item.image} alt={item.name} />
                      <div className="cart-info"><h3>{item.name}</h3><p>₹{item.price}</p></div>
                      <div className="quantity">
                        <button onClick={() => changeQuantity(item.id, -1)}>−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => changeQuantity(item.id, 1)}>+</button>
                      </div>
                      <strong>₹{item.price * item.quantity}</strong>
                    </div>
                  ))}
                </div>
                <aside className="summary">
                  <h2>Order Summary</h2>
                  <p><span>Items</span><span>{cartCount}</span></p>
                  <p><span>Delivery</span><span>Included</span></p>
                  <hr />
                  <h3><span>Total</span><span>₹{total}</span></h3>
                  <button className="main-btn full-btn" onClick={() => navigate("/payment")}>Proceed to Payment</button>
                </aside>
              </div>
            )}
          </main>
        } />

        <Route path="/payment" element={
          <main className="section page-section">
            <p className="eyebrow">ONE LAST STEP</p>
            <h1>Checkout & Payment</h1>
            {!cart.length ? <Empty text="Add food to your cart before checkout." link="/menu" label="Browse Menu" /> : (
              <div className="checkout-layout">
                <form className="form-card" onSubmit={placeOrder}>
                  <h2>Delivery Details</h2>
                  <label>Full Name</label>
                  <input required value={checkout.customerName} onChange={e => setCheckout({ ...checkout, customerName: e.target.value })} placeholder="Enter your name" />
                  <label>Phone Number</label>
                  <input required type="tel" pattern="[0-9]{10}" title="Enter a 10-digit phone number" value={checkout.phone} onChange={e => setCheckout({ ...checkout, phone: e.target.value })} placeholder="10-digit mobile number" />
                  <label>Delivery Address</label>
                  <textarea required value={checkout.address} onChange={e => setCheckout({ ...checkout, address: e.target.value })} placeholder="House number, street, city" />
                  <h2>Payment Method</h2>
                  <label className="payment-option">
                    <input type="radio" checked={checkout.paymentMethod === "Cash on Delivery"} onChange={() => setCheckout({ ...checkout, paymentMethod: "Cash on Delivery" })} />
                    <span>💵 Cash on Delivery</span>
                  </label>
                  <label className="payment-option">
                    <input type="radio" checked={checkout.paymentMethod === "UPI (Demo)"} onChange={() => setCheckout({ ...checkout, paymentMethod: "UPI (Demo)" })} />
                    <span>📱 UPI <small>(demo only)</small></span>
                  </label>
                  <p className="small-note">Online payments are not processed in this demo. Do not enter bank or card details.</p>
                  <button className="main-btn full-btn" disabled={loading}>{loading ? "Placing Order..." : `Place Order · ₹${total}`}</button>
                </form>
                <aside className="summary">
                  <h2>Your Order</h2>
                  {cart.map(item => <p key={item.id}><span>{item.name} × {item.quantity}</span><span>₹{item.price * item.quantity}</span></p>)}
                  <hr />
                  <h2 className="total-price">Total: ₹{total}</h2>
                </aside>
              </div>
            )}
          </main>
        } />

        <Route path="/login" element={
          <main className="auth-wrap">
            <form className="form-card auth-card" onSubmit={submitAuth}>
              <div className="auth-icon">🍽️</div>
              <p className="eyebrow">WELCOME TO DELICIOUS FOOD</p>
              <h1>{isRegister ? "Create Account" : "Welcome Back!"}</h1>
              <p className="muted">{isRegister ? "Join us and discover your favourites." : "Log in to continue your food journey."}</p>
              {isRegister && <>
                <label>Full Name</label>
                <input required value={auth.name} onChange={e => setAuth({ ...auth, name: e.target.value })} placeholder="Your name" />
              </>}
              <label>Email</label>
              <input required type="email" value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })} placeholder="you@example.com" />
              <label>Password</label>
              <input required type="password" minLength="6" value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} placeholder="Enter password" />
              <button className="main-btn full-btn" disabled={loading}>{loading ? "Please wait..." : isRegister ? "Register" : "Login"}</button>
              <p className="switch-auth">{isRegister ? "Already have an account?" : "New to Delicious Food?"}{" "}
                <button type="button" className="inline-link" onClick={() => setIsRegister(!isRegister)}>{isRegister ? "Login" : "Create an account"}</button>
              </p>
            </form>
          </main>
        } />

        <Route path="/orders" element={
          <main className="section page-section">
            <p className="eyebrow">YOUR FOOD JOURNEY</p><h1>My Orders</h1>
            {!token ? <Empty text="Please log in to view your orders." link="/login" label="Login" /> :
              !orders.length ? <Empty text="No orders to show yet." link="/menu" label="Order Food" /> :
              <div className="orders-grid">{orders.map(order => <OrderCard key={order._id} order={order} />)}</div>}
          </main>
        } />

        <Route path="/admin" element={
          <main className="section page-section">
            {!isAdmin ? <Empty text="Admin access is required for this page." link="/" label="Go Home" /> : <>
              <p className="eyebrow">MANAGE YOUR RESTAURANT</p><h1>Admin Dashboard</h1>
              <form className="form-card admin-form" onSubmit={addFood}>
                <h2>Add a Food Item</h2>
                <label>Food Name</label>
                <input required value={newFood.name} onChange={e => setNewFood({ ...newFood, name: e.target.value })} placeholder="e.g. Masala Dosa" />
                <label>Price (₹)</label>
                <input required min="1" type="number" value={newFood.price} onChange={e => setNewFood({ ...newFood, price: e.target.value })} placeholder="e.g. 80" />
                <label>Image URL (optional)</label>
                <input value={newFood.image} onChange={e => setNewFood({ ...newFood, image: e.target.value })} placeholder="Paste direct image URL" />
                <label>Description</label>
                <input value={newFood.description} onChange={e => setNewFood({ ...newFood, description: e.target.value })} placeholder="Short description" />
                <button className="main-btn">Add Food</button>
              </form>
              <h2 className="subheading">Manage Menu</h2>
              <div className="admin-food-list">{foods.map(food => (
                <div className="admin-food" key={food._id}>
                  <img src={foodImage(food)} alt={food.name} />
                  <span>{food.name} · ₹{food.price}</span>
                  <button className="danger-btn" onClick={() => deleteFood(food._id)}>Delete</button>
                </div>
              ))}</div>
              <h2 className="subheading">Manage Orders</h2>
              {!orders.length ? <p>No orders yet.</p> :
                <div className="orders-grid">{orders.map(order => <OrderCard key={order._id} order={order} admin updateOrder={updateOrder} />)}</div>}
            </>}
          </main>
        } />

        <Route path="*" element={<Empty text="Page not found." link="/" label="Go Home" />} />
      </Routes>

      <footer className="footer">
        <Link to="/" className="brand">🍴 Delicious<span>Food</span></Link>
        <p>Made with ❤️ for food lovers.</p>
        <p>© {new Date().getFullYear()} Delicious Food</p>
      </footer>
    </>
  );
}

function FoodGrid({ foods, addToCart }) {
  if (!foods.length) return <p className="muted">No food items found. Check the backend or add items from Admin.</p>;
  return <div className="food-grid">{foods.map(food => (
    <article className="food-card" key={food._id || food.name}>
      <div className="food-image-wrap">
        <img src={foodImage(food)} alt={food.name} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = images.default; }} />
        <span className="food-tag">FRESH & TASTY</span>
      </div>
      <div className="food-details">
        <h3>{food.name}</h3>
        <p>{food.description || "A delicious favourite made with care."}</p>
        <div className="food-bottom"><strong>₹{food.price}</strong><button onClick={() => addToCart(food)}>+ Add</button></div>
      </div>
    </article>
  ))}</div>;
}

function Empty({ text, link, label }) {
  return <div className="empty-state"><span>🍽️</span><h2>{text}</h2><Link className="main-btn" to={link}>{label}</Link></div>;
}

function OrderCard({ order, admin = false, updateOrder }) {
  const statuses = ["Placed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
  return <article className="order-card">
    <div className="order-top">
      <div><span className="muted">Order ID</span><strong>#{String(order._id || "").slice(-7)}</strong></div>
      <span className="status-pill">{order.status || "Placed"}</span>
    </div>
    {order.items?.map((item, index) => <p key={index}>{item.name} × {item.quantity} <span>₹{item.price * item.quantity}</span></p>)}
    <hr />
    <h3>Total <span>₹{order.totalAmount}</span></h3>
    {order.customerName && <p>Customer: {order.customerName}</p>}
    {order.address && <p>Address: {order.address}</p>}
    {admin && <>
      <label>Update Status</label>
      <select value={order.status || "Placed"} onChange={e => updateOrder(order._id, e.target.value)}>
        {statuses.map(status => <option key={status}>{status}</option>)}
      </select>
    </>}
    <small>{order.createdAt ? new Date(order.createdAt).toLocaleString() : ""}</small>
  </article>;
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}
