# LDAP Setup Guide

## Обзор
В проекте настроен OpenLDAP сервер `openldap-zambia` с доменом `zambia.local` и phpLDAPadmin для управления.

**LDAP инициализирован** со структурой ролей и тестовыми пользователями (сотрудники и клиенты).

## Доступ к сервисам

### OpenLDAP
- **Порт**: 389 (LDAP)
- **Base DN**: `dc=zambia,dc=local`
- **Admin DN**: `cn=admin,dc=zambia,dc=local`
- **Admin пароль**: `admin123`

### Техническая учётка Keycloak (read-only)
- **DN**: `cn=keycloak-reader,dc=zambia,dc=local`
- **Пароль**: `keycloak_reader_pass`
- **Права**: Только чтение всех пользователей и групп

### phpLDAPadmin
- **URL**: http://localhost:8081
- **Логин**: `cn=admin,dc=zambia,dc=local`
- **Пароль**: `admin123`

## Структура LDAP

```
dc=zambia,dc=local
├── cn=keycloak-reader (техническая учётка для Keycloak)
├── ou=employees (сотрудники)
│   ├── cn=employee1
│   ├── cn=employee2
│   └── cn=employee3
├── ou=customers (клиенты)
│   ├── cn=customer1
│   ├── cn=customer2
│   └── cn=customer3
└── ou=groups (группы с вложенной иерархией)
    ├── cn=customer (верхний уровень, включает employee)
    ├── cn=employee (вложена в customer, включает administrator)
    └── cn=administrator (вложена в employee)
```

### Иерархия групп
- **administrator** ⊂ **employee** ⊂ **customer**
- Пользователь в группе `administrator` автоматически получает права `employee` и `customer`
- Пользователь в группе `employee` автоматически получает права `customer`

## Управление LDAP через phpLDAPadmin

1. Откройте http://localhost:8081
2. Введите учетные данные администратора:
   - Login DN: `cn=admin,dc=zambia,dc=local`
   - Password: `admin123`
3. Нажмите "Authenticate"

### Создание новых пользователей

1. В левом меню выберите "ou=users,dc=zambia,dc=local"
2. Нажмите "Create a child entry"
3. Выберите шаблон "Generic: User Account"
4. Заполните поля:
   - Common Name (cn)
   - Surname (sn)
   - Given name (givenName)
   - User ID (uid) - обычно совпадает с cn
   - Password
   - Email
5. Сохраните изменения

### Создание новых групп

1. В левом меню выберите "ou=groups,dc=zambia,dc=local"
2. Нажмите "Create a child entry"
3. Выберите шаблон "Generic: Posix Group"
4. Заполните поля:
   - Common Name (cn)
   - GID Number
   - Description
5. Сохраните изменения

### Добавление пользователей в группы

1. Найдите группу в "ou=groups,dc=zambia,dc=local"
2. Выберите "Modify group members"

## Подключение к LDAP из приложений

### Из Keycloak

LDAP User Federation настроен в `realm-export.json` для realm `reports-realm`:

```json
"components": {
  "org.keycloak.storage.UserStorageProvider": [
    {
      "name": "zambia-ldap",
      "providerId": "ldap",
      "config": {
        "enabled": ["true"],
        "editMode": ["READ_ONLY"],
        "connectionUrl": ["ldap://openldap-zambia:389"],
        "usersDn": ["dc=zambia,dc=local"],
        "authType": ["simple"],
        "bindDn": ["cn=keycloak-reader,dc=zambia,dc=local"],
        "bindCredential": ["keycloak_reader_pass"],
        "usernameLDAPAttribute": ["cn"],
        "rdnLDAPAttribute": ["cn"],
        "uuidLDAPAttribute": ["entryUUID"],
        "userObjectClasses": ["inetOrgPerson, organizationalPerson"]
      },
      "subComponents": {
        "org.keycloak.storage.ldap.mappers.LDAPStorageMapper": [
          {
            "name": "group-mapper",
            "providerId": "group-ldap-mapper",
            "config": {
              "groups.dn": ["ou=groups,dc=zambia,dc=local"],
              "group.name.ldap.attribute": ["cn"],
              "group.object.classes": ["groupOfNames"],
              "preserve.group.inheritance": ["true"],
              "membership.ldap.attribute": ["member"],
              "membership.attribute.type": ["DN"],
              "mode": ["LDAP_ONLY"]
            }
          }
        ]
      }
    }
  ]
}
```

**Статус:** ✅ **LDAP User Federation настроен!** 
- Пользователи из LDAP (`customer1`, `customer2`, `employee1`, etc.) могут логиниться в Keycloak
- Группы LDAP (`customer`, `employee`, `administrator`) автоматически синхронизируются
- Вложенная иерархия групп поддерживается (`preserve.group.inheritance: true`)

### Из Java приложений

```java
import javax.naming.*;
import javax.naming.directory.*;
import java.util.Hashtable;

public class LDAPExample {
    public static void main(String[] args) {
        Hashtable<String, String> env = new Hashtable<>();
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.ldap.LdapCtxFactory");
        env.put(Context.PROVIDER_URL, "ldap://localhost:389");
        env.put(Context.SECURITY_AUTHENTICATION, "simple");
        env.put(Context.SECURITY_PRINCIPAL, "cn=admin,dc=zambia,dc=local");
        env.put(Context.SECURITY_CREDENTIALS, "admin123");

        try {
            DirContext ctx = new InitialDirContext(env);
            System.out.println("LDAP connection successful");

            // Поиск пользователей
            SearchControls controls = new SearchControls();
            controls.setSearchScope(SearchControls.SUBTREE_SCOPE);
            NamingEnumeration<SearchResult> results = ctx.search(
                "ou=employees,dc=zambia,dc=local",
                "(objectClass=inetOrgPerson)",
                controls
            );

            while (results.hasMore()) {
                SearchResult result = results.next();
                Attributes attrs = result.getAttributes();
                System.out.println("User: " + result.getName());
                System.out.println("CN: " + attrs.get("cn").get());
            }

            ctx.close();
        } catch (NamingException e) {
            e.printStackTrace();
        }
    }
}
```

## Тестовые пользователи

| Пользователь | Пароль | Роль | OU |
|-------------|--------|------|----|
| employee1 | employee1_password | employee | employees |
| employee2 | employee2_password | employee | employees |
| employee3 | employee3_password | employee | employees |
| customer1 | customer1_password | customer | customers |
| customer2 | customer2_password | customer | customers |
| customer3 | customer3_password | customer | customers |

## Безопасность

- **Пароли**: Все пароли в примере являются тестовыми. В продакшене используйте сложные пароли
- **TLS**: LDAP работает без TLS (389 порт). Для продакшена настройте LDAPS на порту 636
- **Доступ**: Ограничьте доступ к портам LDAP только необходимым сервисам

## Troubleshooting

### Не могу подключиться к phpLDAPadmin
1. Проверьте, что контейнер запущен: `docker-compose ps`
2. Проверьте логи: `docker-compose logs phpldapadmin`
3. Убедитесь, что порт 8081 не занят другим процессом

### Ошибки аутентификации
1. Проверьте корректность DN и пароля
2. Убедитесь, что LDAP сервер запущен
3. Проверьте логи: `docker-compose logs openldap-zambia`

### Проблемы с поиском
1. Проверьте base DN: `dc=zambia,dc=local`
2. Для сотрудников используйте: `ou=employees,dc=zambia,dc=local`
3. Для клиентов используйте: `ou=customers,dc=zambia,dc=local`
4. Убедитесь, что фильтр поиска корректный
5. Проверьте права доступа пользователя
