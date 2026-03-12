const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Band Merch Platform API',
      version: '1.0.0',
      description: 'REST API for managing band merchandise sales across online shop and concert venues',
      contact: {
        name: 'API Support',
        email: 'support@bandmerch.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /api/auth/login'
        }
      },
      schemas: {
        Product: {
          type: 'object',
          required: ['name', 'basePrice'],
          properties: {
            _id: {
              type: 'string',
              description: 'Product ID',
              example: '507f1f77bcf86cd799439011'
            },
            name: {
              type: 'string',
              description: 'Product name',
              example: 'Band Logo T-Shirt'
            },
            description: {
              type: 'string',
              description: 'Product description',
              example: 'Official band t-shirt with logo'
            },
            category: {
              type: 'string',
              description: 'Product category',
              example: 'clothing'
            },
            basePrice: {
              type: 'number',
              description: 'Base price in euros',
              example: 25.00
            },
            images: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of image URLs',
              example: ['https://example.com/image1.jpg']
            },
            active: {
              type: 'boolean',
              description: 'Product visibility status',
              example: true
            },
            variants: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Variant'
              }
            }
          }
        },
        Variant: {
          type: 'object',
          required: ['sku', 'stock'],
          properties: {
            sku: {
              type: 'string',
              description: 'Stock keeping unit',
              example: 'TSHIRT-BLACK-L'
            },
            size: {
              type: 'string',
              description: 'Size',
              example: 'L'
            },
            color: {
              type: 'string',
              description: 'Color',
              example: 'Black'
            },
            stock: {
              type: 'number',
              description: 'Available stock quantity',
              example: 50
            },
            version: {
              type: 'number',
              description: 'Version number for optimistic locking',
              example: 0
            },
            priceAdjustment: {
              type: 'number',
              description: 'Price adjustment from base price',
              example: 0
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Admin username',
              example: 'admin'
            },
            password: {
              type: 'string',
              description: 'Admin password',
              example: 'admin123!'
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: '507f1f77bcf86cd799439011'
                },
                username: {
                  type: 'string',
                  example: 'admin'
                },
                role: {
                  type: 'string',
                  example: 'admin'
                }
              }
            }
          }
        },
        InventoryDeductRequest: {
          type: 'object',
          required: ['productId', 'variantSku', 'quantity', 'source'],
          properties: {
            productId: {
              type: 'string',
              description: 'Product ID',
              example: '507f1f77bcf86cd799439011'
            },
            variantSku: {
              type: 'string',
              description: 'Variant SKU',
              example: 'TSHIRT-BLACK-L'
            },
            quantity: {
              type: 'number',
              description: 'Quantity to deduct',
              example: 2
            },
            source: {
              type: 'string',
              enum: ['online', 'pos'],
              description: 'Sale source',
              example: 'pos'
            },
            customerEmail: {
              type: 'string',
              description: 'Customer email (required for online)',
              example: 'customer@example.com'
            },
            concertId: {
              type: 'string',
              description: 'Concert ID (required for pos)',
              example: '507f1f77bcf86cd799439012'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    },
    security: []
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

module.exports = {
  swaggerUi,
  swaggerSpec
};
