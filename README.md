# Inventory and Data Management System

Backend assignment using only Node.js, Express, Mongoose, MongoDB and dotenv.

## 1. Setup

1. Install Node.js and start MongoDB locally, or create a MongoDB Atlas database.
2. Open this project folder in a terminal.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env` and set `MONGODB_URI`:

   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/inventory_db
   ```

5. Start the server:

   ```bash
   npm start
   ```

   Server: `http://localhost:5000`

## 2. API endpoints

| Method | URL | Purpose |
|---|---|---|
| POST | `/api/products` | Create product |
| GET | `/api/products` | List, filter, sort and paginate |
| GET | `/api/products/:id` | Get one product |
| PUT | `/api/products/:id` | Update product details |
| PATCH | `/api/products/:id/stock` | Restock or record a sale |
| DELETE | `/api/products/:id` | Delete product |
| GET | `/api/products/low-stock` | Low-stock report |
| GET | `/api/products/summary` | Category-wise aggregation |

## 3. Example requests (Postman)

### Create product
`POST http://localhost:5000/api/products`

Body -> raw -> JSON:

```json
{
  "name": "Gel Pen Pack of 15",
  "sku": "STNY-PN-713",
  "category": "Stationery",
  "price": 120,
  "quantity": 40,
  "reorderLevel": 20,
  "supplier": "Cello Pens"
}
```

### List and query
`GET http://localhost:5000/api/products?page=1&limit=10&category=Stationery&sort=price&order=asc`

Other query examples:
- Search: `?search=pen`
- Price range: `?minPrice=50&maxPrice=500`
- Only products in stock: `?inStock=true`
- Out of stock: `?inStock=false`

### Get, update and delete
- `GET /api/products/PRODUCT_ID`
- `PUT /api/products/PRODUCT_ID` with JSON fields to update
- `DELETE /api/products/PRODUCT_ID`

### Stock adjustment
`PATCH http://localhost:5000/api/products/PRODUCT_ID/stock`

Restock body:

```json
{ "change": 10 }
```

Sale body:

```json
{ "change": -3 }
```

A sale is rejected if it would make quantity negative.

### Reports
- `GET http://localhost:5000/api/products/low-stock`
- `GET http://localhost:5000/api/products/summary`

## Notes
- SKU is unique and automatically converted to uppercase.
- `stockValue` is a virtual field calculated as `price * quantity`.
- Low stock means `quantity <= reorderLevel`.
- List responses include total records, current page, total pages and products.
