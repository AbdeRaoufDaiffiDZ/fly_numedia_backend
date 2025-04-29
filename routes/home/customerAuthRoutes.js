const router = require('express').Router()
const customerAuthController = require('../../controllers/home/customerAuthController')
router.post('/customer/customer-register', customerAuthController.customer_register)  //done
router.post('/customer/customer-login', customerAuthController.customer_login) //done
router.get('/customer/logout', customerAuthController.customer_logout) //done
module.exports = router