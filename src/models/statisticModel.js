import { getDB } from "../config/mongo.js";

// ============================================================
// PHẦN 1: THỐNG KÊ ĐƠN HÀNG & DOANH THU (Nghê Minh Trí)
// ============================================================

// Câu 1: Doanh thu theo tháng 
const getMonthlyRevenue = async () => {
  try {
    return await getDB().collection("orders").aggregate([
      { $match: { status: "delivered" } },
      { $group: {
          _id: { 
              Thang: { $month: { $toDate: "$createAt" } }, 
              Nam: { $year: { $toDate: "$createAt" } } 
              // -----------------------------------
          },
          DoanhThu: { $sum: "$totalPriceOrder" },
          SoDon: { $sum: 1 }
      }},
      { $sort: { "_id.Nam": 1, "_id.Thang": 1 } }
    ]).toArray();
  } catch (error) { throw new Error(error); }
};

// Câu 2: Tỉ lệ các trạng thái đơn hàng (Pending/Shipped/...)
const getOrderStatusStats = async () => {
    try {
        return await getDB().collection("orders").aggregate([
            { $group: {
                _id: "$status",
                SoLuong: { $sum: 1 },
                TongGiaTri: { $sum: "$totalPriceOrder" }
            }},
            { $sort: { SoLuong: -1 } }
        ]).toArray();
    } catch (error) { throw new Error(error); }
};

// Câu 3: Top 5 Đơn hàng giá trị cao nhất (Kèm thông tin khách)
const getTopOrders = async () => {
    try {
        return await getDB().collection("orders").aggregate([
            { $match: { status: "delivered" } },
            { $sort: { totalPriceOrder: -1 } },
            { $limit: 5 },
            // Join với User để lấy tên hiển thị cho đẹp
            { $lookup: {
                from: "users",
                let: { uId: "$userId" },
                pipeline: [
                    { $match: { $expr: { $or: [ { $eq: ["$_id", "$$uId"] }, { $eq: [{ $toString: "$_id" }, "$$uId"] } ] } } }
                ],
                as: "customer"
            }},
            { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
            { $project: { 
                _id: 1, totalPriceOrder: 1, createAt: 1, 
                customerName: { $ifNull: ["$customer.username", "$firstName"] } 
            }}
        ]).toArray();
    } catch (error) { throw new Error(error); }
};


// ============================================================
// PHẦN 2: THỐNG KÊ SẢN PHẨM & KHO (Nguyên)
// ============================================================

// Câu 4: Top 5 Sản phẩm bán chạy nhất (Đã có)
const getTopSellingProducts = async () => {
  try {
    return await getDB().collection("orders").aggregate([
      { $match: { status: { $ne: "cancelled" } } }, // Không tính đơn hủy
      { $unwind: "$listProduct" },
      { $group: {
          _id: "$listProduct.productId",
          TenSP: { $first: "$listProduct.name" },
          DaBan: { $sum: "$listProduct.quantity" },
          DoanhThuSP: { $sum: "$listProduct.totalPrice" }
      }},
      { $sort: { DaBan: -1 } },
      { $limit: 5 }
    ]).toArray();
  } catch (error) { throw new Error(error); }
};

// Câu 5: Thống kê tồn kho theo Thương hiệu
const getBrandStats = async () => {
    try {
        return await getDB().collection("products").aggregate([
            { $match: { _destroy: false } },
            { $group: {
                _id: "$brand",
                SoLuongSP: { $sum: 1 },
                TongTonKho: { $sum: "$stock" },
                GiaTrungBinh: { $avg: "$price" }
            }},
            { $sort: { TongTonKho: -1 } }
        ]).toArray();
    } catch (error) { throw new Error(error); }
};

// Câu 6: Sản phẩm "tồn kho" (Chưa bán được cái nào)
const getUnsoldProducts = async () => {
    try {
        return await getDB().collection("products").aggregate([
            { $lookup: {
                from: "orders",
                localField: "_id",
                foreignField: "listProduct.productId", // Tìm ID sản phẩm trong mảng chi tiết đơn
                as: "don_hang"
            }},
            { $match: { "don_hang": { $size: 0 } } }, // Chỉ lấy cái nào mảng đơn hàng rỗng
            { $project: { name: 1, price: 1, stock: 1, image: 1 } },
            { $limit: 5 } 
        ]).toArray();
    } catch (error) { throw new Error(error); }
};


// ============================================================
// PHẦN 3: THỐNG KÊ KHÁCH HÀNG (Trung)
// ============================================================

// Câu 7: Top 5 Khách hàng VIP (Chi tiêu nhiều nhất)
const getVipCustomers = async () => {
    try {
        return await getDB().collection("orders").aggregate([
            { $match: { status: "delivered" } },
            { $group: {
                _id: "$userId",
                TongChiTieu: { $sum: "$totalPriceOrder" },
                SoDonMua: { $sum: 1 }
            }},
            { $sort: { TongChiTieu: -1 } },
            { $limit: 5 },
            // Join lấy tên
            { $lookup: {
                from: "users",
                let: { uId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $or: [ { $eq: ["$_id", "$$uId"] }, { $eq: [{ $toString: "$_id" }, "$$uId"] } ] } } }
                ],
                as: "info"
            }},
            { $unwind: { path: "$info", preserveNullAndEmptyArrays: true } }
        ]).toArray();
    } catch (error) { throw new Error(error); }
};

// Câu 8: Thống kê khách hàng theo Tỉnh/Thành phố
const getCustomerByCity = async () => {
    try {
        return await getDB().collection("orders").aggregate([
            { $group: {
                _id: "$city",
                SoLuongKhach: { $sum: 1 }, // Đếm số đơn (tạm tính là số khách ở vùng đó)
                TongDoanhThuVung: { $sum: "$totalPriceOrder" }
            }},
            { $match: { _id: { $ne: "" } } }, // Bỏ địa chỉ rỗng
            { $sort: { SoLuongKhach: -1 } },
            { $limit: 5 }
        ]).toArray();
    } catch (error) { throw new Error(error); }
};

// Câu 9: Khách hàng tiềm năng (Đã đăng ký nhưng chưa mua)
const getPotentialCustomers = async () => {
    try {
        return await getDB().collection("users").aggregate([
            { $lookup: {
                from: "orders",
                localField: "email", 
                foreignField: "email",
                as: "history"
            }},
            { $match: { "history": { $size: 0 }, role: { $ne: "admin" } } },
            { $project: { username: 1, email: 1, createdAt: 1 } },
            { $limit: 5 }
        ]).toArray();
    } catch (error) { throw new Error(error); }
};


// ============================================================
// PHẦN 4: THỐNG KÊ ĐÁNH GIÁ (Đoan)
// ============================================================

// Câu 10: Sản phẩm được đánh giá cao nhất
const getTopRatedProducts = async () => {
    try {
        return await getDB().collection("reviews").aggregate([
            { $match: { _destroy: false } },
            { $group: {
                _id: "$productId",
                DiemTB: { $avg: "$rating" },
                SoLuotDanhGia: { $sum: 1 }
            }},
            { $sort: { DiemTB: -1 } },
            { $limit: 5 },
            { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "sp" } },
            { $unwind: "$sp" }
        ]).toArray();
    } catch (error) { throw new Error(error); }
};

// Câu 11: Các đánh giá tiêu cực cần xử lý (1-2 sao)
const getNegativeReviews = async () => {
    try {
        return await getDB().collection("reviews").aggregate([
            { $match: { rating: { $lte: 2 }, _destroy: false } },
            { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "u" } },
            { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
            { $project: { rating: 1, comment: 1, userName: "$u.username", createdAt: 1 } },
            { $limit: 5 }
        ]).toArray();
    } catch (error) { throw new Error(error); }
};

// Câu 12: Hoạt động đánh giá gần đây
const getRecentActivity = async () => {
    try {
        return await getDB().collection("reviews").aggregate([
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "u" } },
            { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
            { $project: { rating: 1, comment: 1, userName: "$u.username", createdAt: 1 } }
        ]).toArray();
    } catch (error) { throw new Error(error); }
};

export const statisticModel = {
  getMonthlyRevenue, getOrderStatusStats, getTopOrders,      // SV1
  getTopSellingProducts, getBrandStats, getUnsoldProducts,   // SV2
  getVipCustomers, getCustomerByCity, getPotentialCustomers, // SV3
  getTopRatedProducts, getNegativeReviews, getRecentActivity // SV4
};